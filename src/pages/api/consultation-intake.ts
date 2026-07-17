import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { getConsultationConfig, type ConsultationConfig } from '../../lib/consultation-config';
import { validateContactIntake } from '../../lib/consultation-intake';
import { contactPayloadFingerprint } from '../../lib/consultation-fingerprint';
import { IdempotencyConflictError, NotionConsultationStore } from '../../lib/notion-consultation';
import { verifyTurnstile } from '../../lib/consultation-turnstile';
import { readBoundedBody } from '../../lib/intake-http';
import { consultationAbuseLimiter, consultationPreTurnstileLimiter, type AbuseLimitInput, type AbuseLimitResult } from '../../lib/consultation-abuse-limit';
import { UpstashAbuseLimiter, type DistributedLimitResult } from '../../lib/consultation-distributed-limit';
import { assessIntakeSecurity } from '../../lib/consultation-security-signals';
import { trustedClientIp } from '../../lib/trusted-client-ip';
import type { IntakeAttribution } from '../../lib/intake-attribution';

type Dependencies = { config?: ConsultationConfig; store?: NotionConsultationStore; fetcher?: typeof fetch; now?: () => Date; receipt?: () => string; preLimiter?: { check: (input: AbuseLimitInput) => AbuseLimitResult }; limiter?: { check: (input: AbuseLimitInput) => AbuseLimitResult }; distributedLimiter?: { check: (input: AbuseLimitInput) => Promise<DistributedLimitResult> } };

const headers = (origin: string | null, allowed: boolean) => ({
  ...(allowed && origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', Vary: 'Origin',
  'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
});
const response = (status: number, body: Record<string, unknown>, origin: string | null, allowed: boolean) => new Response(JSON.stringify(body), { status, headers: headers(origin, allowed) });
const attributionLogFields = (attribution?: IntakeAttribution) => {
  if (!attribution) return {};
  const value = attribution as { cellId?: string; offer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };
  return {
    ...(value.cellId ? { cellId: value.cellId } : {}), ...(value.offer ? { offer: value.offer } : {}),
    ...(value.utmSource ? { utmSource: value.utmSource } : {}), ...(value.utmMedium ? { utmMedium: value.utmMedium } : {}),
    ...(value.utmCampaign ? { utmCampaign: value.utmCampaign } : {}),
  };
};

function sourceMatchesOrigin(source: string, origin: string): boolean {
  let hostname = '';
  try { hostname = new URL(origin).hostname; } catch { return false; }
  if (hostname.endsWith('.vercel.app')) return source.startsWith('aoifuture.com/');
  if (hostname === 'aoifuture.com' || hostname === 'www.aoifuture.com') return source.startsWith('aoifuture.com/');
  if (hostname === 'nozaki.com' || hostname === 'www.nozaki.com') return source === 'nozaki.com';
  if (hostname === 'wfhradio.tokyo' || hostname === 'www.wfhradio.tokyo') return source === 'wfhradio.tokyo';
  if (hostname === 'dispatch.aoifuture.com') return source === 'dispatch.aoifuture.com';
  return false;
}

export async function handleContactIntake(request: Request, deps: Dependencies = {}): Promise<Response> {
  const config = deps.config || getConsultationConfig();
  const origin = request.headers.get('origin');
  const originAllowed = !!origin && config.allowedOrigins.includes(origin);
  if (request.method === 'OPTIONS') return originAllowed ? new Response(null, { status: 204, headers: headers(origin, true) }) : response(403, { error: 'origin_not_allowed' }, origin, false);
  if (request.method !== 'POST') {
    const result = response(405, { error: 'method_not_allowed' }, origin, originAllowed);
    result.headers.set('Allow', 'POST, OPTIONS');
    return result;
  }
  if (!config.enabled) return response(503, { error: 'intake_disabled', fallbackUrl: config.fallbackUrl }, origin, originAllowed);
  if (config.requireTurnstile && (!config.turnstileSiteKey || !config.turnstileSecretKey)) return response(503, { error: 'turnstile_not_configured' }, origin, originAllowed);
  if (!originAllowed) return response(403, { error: 'origin_not_allowed' }, origin, false);
  const body = await readBoundedBody(request);
  if (!body.ok) return response(body.status, { error: body.error }, origin, true);
  let raw: unknown;
  try { raw = JSON.parse(body.text); } catch { return response(400, { error: 'invalid_json' }, origin, true); }
  const now = (deps.now || (() => new Date()))();
  const validation = validateContactIntake(raw, now.getTime());
  if (!validation.ok) return response(400, { error: 'validation_failed', fields: validation.errors }, origin, true);
  const security = assessIntakeSecurity(validation.value, now.getTime());
  if (!config.requireTurnstile && security.flags.includes('Fast submit')) return response(400, { error: 'validation_failed', fields: { 'antiSpam.formStartedAt': 'submitted_too_quickly' } }, origin, true);
  if (!sourceMatchesOrigin(validation.value.source, origin)) return response(400, { error: 'source_origin_mismatch' }, origin, true);
  const idempotencyHeader = request.headers.get('idempotency-key');
  if (idempotencyHeader && idempotencyHeader !== validation.value.idempotencyKey) return response(409, { error: 'idempotency_conflict' }, origin, true);

  const ip = trustedClientIp(request.headers);
  const preLimit = (deps.preLimiter || consultationPreTurnstileLimiter).check({ ip, email: validation.value.email, idempotencyKey: validation.value.idempotencyKey, now: now.getTime() });
  if (!preLimit.allowed) {
    const limited = response(429, { error: 'rate_limited', retryAfter: preLimit.retryAfter }, origin, true);
    limited.headers.set('Retry-After', String(preLimit.retryAfter));
    return limited;
  }
  const turnstileHostname = origin ? new URL(origin).hostname : '';
  const turnstile = await verifyTurnstile(validation.value.antiSpam.turnstileToken, ip, {
    secretKey: config.turnstileSecretKey, required: config.requireTurnstile, allowedHostnames: [turnstileHostname],
    idempotencyKey: validation.value.idempotencyKey, expectedAction: 'contact_intake',
  }, deps.fetcher);
  if (!turnstile.ok) return response(turnstile.reason === 'turnstile_unavailable' || turnstile.reason === 'turnstile_not_configured' ? 503 : 400, { error: turnstile.reason }, origin, true);
  const abuseLimit = (deps.limiter || consultationAbuseLimiter).check({ ip, email: validation.value.email, idempotencyKey: validation.value.idempotencyKey, now: now.getTime() });
  if (!abuseLimit.allowed) {
    const limited = response(429, { error: 'rate_limited', retryAfter: abuseLimit.retryAfter }, origin, true);
    limited.headers.set('Retry-After', String(abuseLimit.retryAfter));
    return limited;
  }
  const distributedConfigured = !!(
    config.distributedLimitUrl?.startsWith('https://') && config.distributedLimitToken &&
    config.distributedLimitHashSecret?.length >= 32 && /^[A-Za-z0-9_-]{1,40}$/.test(config.distributedLimitNamespace || '')
  );
  if (config.requireDistributedLimit && !distributedConfigured && !deps.distributedLimiter) return response(503, { error: 'abuse_protection_unavailable' }, origin, true);
  if (distributedConfigured || deps.distributedLimiter) {
    const distributedLimiter = deps.distributedLimiter || new UpstashAbuseLimiter({ url: config.distributedLimitUrl, token: config.distributedLimitToken, hashSecret: config.distributedLimitHashSecret, namespace: config.distributedLimitNamespace });
    const distributed = await distributedLimiter.check({ ip, email: validation.value.email, idempotencyKey: validation.value.idempotencyKey, now: now.getTime() });
    if (!distributed.allowed) {
      if ('unavailable' in distributed) return response(503, { error: 'abuse_protection_unavailable' }, origin, true);
      if (distributed.breaker) return response(503, { error: 'intake_temporarily_paused' }, origin, true);
      const limited = response(429, { error: 'rate_limited', retryAfter: distributed.retryAfter }, origin, true);
      limited.headers.set('Retry-After', String(distributed.retryAfter));
      return limited;
    }
    if (distributed.softDaily) console.warn(JSON.stringify({ event: 'contact_intake_abuse', result: 'daily_soft_threshold', status: 200 }));
  }
  if (!config.notionApiKey || !config.notionDataSourceId) return response(503, { error: 'storage_not_configured' }, origin, true);

  const store = deps.store || new NotionConsultationStore({ apiKey: config.notionApiKey, dataSourceId: config.notionDataSourceId, apiVersion: config.notionApiVersion });
  const payloadFingerprint = contactPayloadFingerprint(validation.value);
  const started = Date.now();
  try {
    const duplicate = await store.findByIdempotencyKey(validation.value.idempotencyKey);
    if (duplicate) {
      if (duplicate.payloadFingerprint !== payloadFingerprint) return response(409, { error: 'idempotency_conflict' }, origin, true);
      return response(200, { ok: true, receiptId: duplicate.receiptId, duplicate: true }, origin, true);
    }
    if (!distributedConfigured && !deps.distributedLimiter) {
      const rate = await store.enforceRateLimits(validation.value.email.toLowerCase(), now);
      if (!rate.allowed) {
        const retryAfter = rate.reason === 'email_daily_limit' ? 86400 : 3600;
        const limited = response(429, { error: 'rate_limited', retryAfter }, origin, true);
        limited.headers.set('Retry-After', String(retryAfter));
        return limited;
      }
    }
    const receiptId = (deps.receipt || (() => `AOI-${randomBytes(4).toString('hex').toUpperCase()}`))();
    const stored = await store.create(validation.value, receiptId, now, security);
    console.info(JSON.stringify({ event: 'contact_intake', source: validation.value.source, inquiryType: validation.value.inquiryType, ...(validation.value.stage ? { stage: validation.value.stage } : {}), ...attributionLogFields(validation.value.attribution), quarantined: security.quarantine, result: stored.receiptId === receiptId ? 'created' : 'duplicate', status: stored.receiptId === receiptId ? 201 : 200, latency: Date.now() - started < 1000 ? 'lt1s' : Date.now() - started < 5000 ? '1-5s' : 'gte5s' }));
    return response(stored.receiptId === receiptId ? 201 : 200, { ok: true, receiptId: stored.receiptId, duplicate: stored.receiptId !== receiptId }, origin, true);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) return response(409, { error: 'idempotency_conflict' }, origin, true);
    // A timed-out create may have succeeded. One durable lookup resolves a safe retry.
    try {
      const stored = await store.findByIdempotencyKey(validation.value.idempotencyKey);
      if (stored?.payloadFingerprint === payloadFingerprint) return response(200, { ok: true, receiptId: stored.receiptId, duplicate: true }, origin, true);
      if (stored) return response(409, { error: 'idempotency_conflict' }, origin, true);
    } catch { /* fail closed */ }
    console.warn(JSON.stringify({ event: 'contact_intake', source: validation.value.source, inquiryType: validation.value.inquiryType, ...(validation.value.stage ? { stage: validation.value.stage } : {}), ...attributionLogFields(validation.value.attribution), result: 'storage_unavailable', status: 503, latency: Date.now() - started < 1000 ? 'lt1s' : Date.now() - started < 5000 ? '1-5s' : 'gte5s' }));
    return response(503, { error: 'storage_unavailable' }, origin, true);
  }
}

export const handleConsultationIntake = handleContactIntake;
export const POST: APIRoute = ({ request }) => handleContactIntake(request);
export const OPTIONS: APIRoute = ({ request }) => handleContactIntake(request);
export const ALL: APIRoute = ({ request }) => handleContactIntake(request);
