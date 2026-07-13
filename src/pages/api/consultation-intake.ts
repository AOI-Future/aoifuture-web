import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { getConsultationConfig, type ConsultationConfig } from '../../lib/consultation-config';
import { validateConsultationIntake } from '../../lib/consultation-intake';
import { NotionConsultationStore } from '../../lib/notion-consultation';
import { verifyTurnstile } from '../../lib/consultation-turnstile';

const MAX_BODY_BYTES = 16 * 1024;
type Dependencies = { config?: ConsultationConfig; store?: NotionConsultationStore; fetcher?: typeof fetch; now?: () => Date; receipt?: () => string };

const headers = (origin: string | null, allowed: boolean) => ({
  ...(allowed && origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin',
  'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8',
});
const response = (status: number, body: Record<string, unknown>, origin: string | null, allowed: boolean) => new Response(JSON.stringify(body), { status, headers: headers(origin, allowed) });

export async function handleConsultationIntake(request: Request, deps: Dependencies = {}): Promise<Response> {
  const config = deps.config || getConsultationConfig();
  const origin = request.headers.get('origin');
  const originAllowed = !!origin && config.allowedOrigins.includes(origin);
  if (request.method === 'OPTIONS') return originAllowed ? new Response(null, { status: 204, headers: headers(origin, true) }) : response(403, { error: 'origin_not_allowed' }, origin, false);
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' }, origin, originAllowed);
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
  const validation = validateConsultationIntake(raw, now.getTime());
  if (!validation.ok) return response(400, { error: 'validation_failed', fields: validation.errors }, origin, true);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const turnstile = await verifyTurnstile(validation.value.antiSpam.turnstileToken, ip, {
    secretKey: config.turnstileSecretKey, required: config.requireTurnstile, allowedHostnames: config.allowedHostnames,
  }, deps.fetcher);
  if (!turnstile.ok) return response(turnstile.reason === 'turnstile_unavailable' || turnstile.reason === 'turnstile_not_configured' ? 503 : 400, { error: turnstile.reason }, origin, true);
  if (!config.notionApiKey || !config.notionDataSourceId) return response(503, { error: 'storage_not_configured' }, origin, true);

  const store = deps.store || new NotionConsultationStore({ apiKey: config.notionApiKey, dataSourceId: config.notionDataSourceId, apiVersion: config.notionApiVersion });
  const started = Date.now();
  try {
    const duplicate = await store.findByIdempotencyKey(validation.value.idempotencyKey);
    if (duplicate) return response(200, { ok: true, receiptId: duplicate.receiptId, duplicate: true }, origin, true);
    const rate = await store.enforceRateLimits(validation.value.email.toLowerCase(), now);
    if (!rate.allowed) return response(429, { error: 'rate_limited', retryAfter: rate.reason === 'email_daily_limit' ? 86400 : 3600 }, origin, true);
    const receiptId = (deps.receipt || (() => `AOI-${randomBytes(4).toString('hex').toUpperCase()}`))();
    const stored = await store.create(validation.value, receiptId, now);
    console.info(JSON.stringify({ event: 'consultation_intake', receipt: stored.receiptId.slice(0, 12), stage: validation.value.stage, result: stored.receiptId === receiptId ? 'created' : 'duplicate', status: stored.receiptId === receiptId ? 201 : 200, latency: Date.now() - started < 1000 ? 'lt1s' : Date.now() - started < 5000 ? '1-5s' : 'gte5s' }));
    return response(stored.receiptId === receiptId ? 201 : 200, { ok: true, receiptId: stored.receiptId, duplicate: stored.receiptId !== receiptId }, origin, true);
  } catch {
    // A timed-out create may have succeeded. One durable lookup resolves a safe retry.
    try {
      const stored = await store.findByIdempotencyKey(validation.value.idempotencyKey);
      if (stored) return response(200, { ok: true, receiptId: stored.receiptId, duplicate: true }, origin, true);
    } catch { /* fail closed */ }
    console.warn(JSON.stringify({ event: 'consultation_intake', stage: validation.value.stage, result: 'storage_unavailable', status: 503, latency: Date.now() - started < 1000 ? 'lt1s' : Date.now() - started < 5000 ? '1-5s' : 'gte5s' }));
    return response(503, { error: 'storage_unavailable' }, origin, true);
  }
}

export const ALL: APIRoute = ({ request }) => handleConsultationIntake(request);
