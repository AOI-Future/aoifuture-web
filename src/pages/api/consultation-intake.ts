import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { getConsultationConfig, type ConsultationConfig } from '../../lib/consultation-config';
import { validateContactIntake } from '../../lib/consultation-intake';
import { contactPayloadFingerprint } from '../../lib/consultation-fingerprint';
import { IdempotencyConflictError, NotionConsultationStore } from '../../lib/notion-consultation';
import { verifyTurnstile } from '../../lib/consultation-turnstile';

const MAX_BODY_BYTES = 16 * 1024;
type Dependencies = { config?: ConsultationConfig; store?: NotionConsultationStore; fetcher?: typeof fetch; now?: () => Date; receipt?: () => string };

const headers = (origin: string | null, allowed: boolean) => ({
  ...(allowed && origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', Vary: 'Origin',
  'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
});
const response = (status: number, body: Record<string, unknown>, origin: string | null, allowed: boolean) => new Response(JSON.stringify(body), { status, headers: headers(origin, allowed) });

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
  if (!originAllowed) return response(403, { error: 'origin_not_allowed' }, origin, false);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return response(415, { error: 'json_required' }, origin, true);
  const declared = Number(request.headers.get('content-length') || '0');
  if (declared > MAX_BODY_BYTES) return response(413, { error: 'body_too_large' }, origin, true);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return response(413, { error: 'body_too_large' }, origin, true);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return response(400, { error: 'invalid_json' }, origin, true); }
  const now = (deps.now || (() => new Date()))();
  const validation = validateContactIntake(raw, now.getTime());
  if (!validation.ok) return response(400, { error: 'validation_failed', fields: validation.errors }, origin, true);
  if (!sourceMatchesOrigin(validation.value.source, origin)) return response(400, { error: 'source_origin_mismatch' }, origin, true);
  const idempotencyHeader = request.headers.get('idempotency-key');
  if (idempotencyHeader && idempotencyHeader !== validation.value.idempotencyKey) return response(409, { error: 'idempotency_conflict' }, origin, true);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const turnstile = await verifyTurnstile(validation.value.antiSpam.turnstileToken, ip, {
    secretKey: config.turnstileSecretKey, required: config.requireTurnstile, allowedHostnames: config.allowedHostnames,
  }, deps.fetcher);
  if (!turnstile.ok) return response(turnstile.reason === 'turnstile_unavailable' || turnstile.reason === 'turnstile_not_configured' ? 503 : 400, { error: turnstile.reason }, origin, true);
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
    const rate = await store.enforceRateLimits(validation.value.email.toLowerCase(), now);
    if (!rate.allowed) return response(429, { error: 'rate_limited', retryAfter: rate.reason === 'email_daily_limit' ? 86400 : 3600 }, origin, true);
    const receiptId = (deps.receipt || (() => `AOI-${randomBytes(4).toString('hex').toUpperCase()}`))();
    const stored = await store.create(validation.value, receiptId, now);
    console.info(JSON.stringify({ event: 'contact_intake', receipt: stored.receiptId.slice(0, 12), source: validation.value.source, inquiryType: validation.value.inquiryType, ...(validation.value.stage ? { stage: validation.value.stage } : {}), result: stored.receiptId === receiptId ? 'created' : 'duplicate', status: stored.receiptId === receiptId ? 201 : 200, latency: Date.now() - started < 1000 ? 'lt1s' : Date.now() - started < 5000 ? '1-5s' : 'gte5s' }));
    return response(stored.receiptId === receiptId ? 201 : 200, { ok: true, receiptId: stored.receiptId, duplicate: stored.receiptId !== receiptId }, origin, true);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) return response(409, { error: 'idempotency_conflict' }, origin, true);
    // A timed-out create may have succeeded. One durable lookup resolves a safe retry.
    try {
      const stored = await store.findByIdempotencyKey(validation.value.idempotencyKey);
      if (stored?.payloadFingerprint === payloadFingerprint) return response(200, { ok: true, receiptId: stored.receiptId, duplicate: true }, origin, true);
      if (stored) return response(409, { error: 'idempotency_conflict' }, origin, true);
    } catch { /* fail closed */ }
    console.warn(JSON.stringify({ event: 'contact_intake', source: validation.value.source, inquiryType: validation.value.inquiryType, ...(validation.value.stage ? { stage: validation.value.stage } : {}), result: 'storage_unavailable', status: 503, latency: Date.now() - started < 1000 ? 'lt1s' : Date.now() - started < 5000 ? '1-5s' : 'gte5s' }));
    return response(503, { error: 'storage_unavailable' }, origin, true);
  }
}

export const handleConsultationIntake = handleContactIntake;
export const POST: APIRoute = ({ request }) => handleContactIntake(request);
export const OPTIONS: APIRoute = ({ request }) => handleContactIntake(request);
export const ALL: APIRoute = ({ request }) => handleContactIntake(request);
