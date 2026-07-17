import { describe, expect, it, vi } from 'vitest';
import { getConsultationConfig } from '../src/lib/consultation-config';
import { contactPayloadFingerprint } from '../src/lib/consultation-fingerprint';
import { handleContactIntake, handleConsultationIntake } from '../src/pages/api/consultation-intake';

const config: any = { enabled: true, fallbackUrl: 'https://fallback.test', allowedOrigins: ['https://aoifuture.com'], allowedHostnames: ['aoifuture.com'], turnstileSiteKey: '', turnstileSecretKey: '', requireTurnstile: false, notionApiKey: 'k', notionDataSourceId: 'd', notionApiVersion: '2025-09-03' };
const body = () => ({ schemaVersion: '2026-07-14', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', source: 'aoifuture.com/contact', inquiryType: 'General / Other', situation: 'A real workflow problem', email: 'test@example.com', consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' }, antiSpam: { turnstileToken: '', website: '', formStartedAt: Date.parse('2026-07-14T11:59:50Z') } });
const req = (payload: any = body(), headers: Record<string, string> = {}) => new Request('https://aoifuture.com/api/contact-intake', { method: 'POST', headers: { origin: 'https://aoifuture.com', 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
const now = () => new Date('2026-07-14T12:00:00Z');
const allowLimiter = { check: () => ({ allowed: true as const }) };
const deps = (overrides: Record<string, unknown>) => ({ preLimiter: allowLimiter, limiter: allowLimiter, ...overrides });

describe('shared contact API', () => {
  it('keeps the consultation handler as a compatible alias', () => expect(handleConsultationIntake).toBe(handleContactIntake));

  it('includes all first-party sites in default CORS origins', () => {
    expect(getConsultationConfig({}).allowedOrigins).toEqual([
      'https://aoifuture.com', 'https://www.aoifuture.com', 'https://nozaki.com', 'https://www.nozaki.com', 'https://wfhradio.tokyo', 'https://www.wfhradio.tokyo', 'https://dispatch.aoifuture.com',
    ]);
  });

  it('handles CORS preflight for the shared contract', async () => {
    const res = await handleContactIntake(new Request('https://aoifuture.com/api/contact-intake', { method: 'OPTIONS', headers: { origin: 'https://aoifuture.com' } }), { config });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('Idempotency-Key');
  });

  it('rejects disabled, origin, media type and schema', async () => {
    expect((await handleContactIntake(req(), { config: { ...config, enabled: false } })).status).toBe(503);
    expect((await handleContactIntake(new Request('https://x.test', { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' }), { config })).status).toBe(403);
    expect((await handleContactIntake(req(body(), { 'content-type': 'text/plain' }), { config })).status).toBe(415);
    expect((await handleContactIntake(req(body(), { 'content-type': 'application/jsonp' }), { config })).status).toBe(415);
    expect((await handleContactIntake(req({ ...body(), extra: true }), deps({ config, now }))).status).toBe(400);
  });

  it('fails closed when required Turnstile configuration is incomplete', async () => {
    const res = await handleContactIntake(req(), deps({ config: { ...config, requireTurnstile: true, turnstileSiteKey: '', turnstileSecretKey: '' }, now }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'turnstile_not_configured' });
  });

  it('rejects a mismatched Idempotency-Key header', async () => {
    expect((await handleContactIntake(req(body(), { 'idempotency-key': 'different' }), deps({ config, now }))).status).toBe(409);
  });

  it('rejects a source that does not match the public origin', async () => {
    expect((await handleContactIntake(req({ ...body(), source: 'wfhradio.tokyo' }), deps({ config, now }))).status).toBe(400);
    expect((await handleContactIntake(req({ ...body(), source: 'manual' }), deps({ config, now }))).status).toBe(400);
  });

  it('binds a Turnstile token hostname to the asserted Origin and source', async () => {
    const payload = { ...body(), source: 'nozaki.com', antiSpam: { ...body().antiSpam, turnstileToken: 'token' } };
    const request = new Request('https://aoifuture.com/api/contact-intake', {
      method: 'POST', headers: { origin: 'https://nozaki.com', 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, hostname: 'aoifuture.com', action: 'contact_intake' })));
    const response = await handleContactIntake(request, deps({
      config: { ...config, allowedOrigins: [...config.allowedOrigins, 'https://nozaki.com'], requireTurnstile: true, turnstileSiteKey: 'site', turnstileSecretKey: 'secret' },
      now, fetcher,
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'turnstile_hostname_invalid' });
  });

  it('returns created only after store create', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => null), enforceRateLimits: vi.fn(async () => ({ allowed: true })), create: vi.fn(async () => ({ receiptId: 'AOI-TEST0001', pageId: 'p' })) };
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const res = await handleContactIntake(req({ ...body(), displayName: 'Private Person', email: 'private@example.com', organization: 'Private Org' }), deps({ config, store, now, receipt: () => 'AOI-TEST0001' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, receiptId: 'AOI-TEST0001', duplicate: false });
    expect(store.create).toHaveBeenCalledOnce();
    const serializedLog = String(log.mock.calls[0][0]);
    expect(serializedLog).toContain('"source":"aoifuture.com/contact"');
    expect(serializedLog).toContain('"inquiryType":"General / Other"');
    expect(serializedLog).not.toMatch(/Private Person|private@example.com|Private Org/);
    log.mockRestore();
  });

  it('logs only bounded non-PII attribution fields', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => null), enforceRateLimits: vi.fn(async () => ({ allowed: true })), create: vi.fn(async () => ({ receiptId: 'AOI-ATTR0001', pageId: 'p' })) };
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const unsafe = { ...body(), attribution: { cellId: 'cell-1', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'agent_security', utmContent: 'private@example.com', entryPath: '/agent-security/verification-support/', offer: 'sprint' } };
    expect((await handleContactIntake(req(unsafe), deps({ config, store, now }))).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
    const safe = { ...unsafe, attribution: { ...unsafe.attribution, utmContent: 'rsa-1' } };
    expect((await handleContactIntake(req(safe), deps({ config, store, now, receipt: () => 'AOI-ATTR0001' }))).status).toBe(201);
    const serialized = String(log.mock.calls[0][0]);
    expect(serialized).toContain('"cellId":"cell-1"');
    expect(serialized).toContain('"offer":"sprint"');
    expect(serialized).toContain('"utmCampaign":"agent_security"');
    expect(serialized).not.toMatch(/utmContent|entryPath|@example|situation|email|token|receipt|AOI-ATTR/i);
    log.mockRestore();
  });

  it('returns durable duplicate and skips rate/create', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => ({ receiptId: 'AOI-OLD', pageId: 'p', payloadFingerprint: contactPayloadFingerprint(body() as any) })), enforceRateLimits: vi.fn(), create: vi.fn() };
    const res = await handleContactIntake(req(), deps({ config, store, now }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true, receiptId: 'AOI-OLD' });
    expect(store.create).not.toHaveBeenCalled();
  });

  it('rejects the same idempotency key with a changed normalized payload', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => ({ receiptId: 'AOI-OLD', pageId: 'p', payloadFingerprint: 'different' })), enforceRateLimits: vi.fn(), create: vi.fn() };
    const res = await handleContactIntake(req({ ...body(), situation: 'Changed business payload' }), deps({ config, store, now }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'idempotency_conflict' });
    expect(store.enforceRateLimits).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });

  it('treats a legacy duplicate without a fingerprint as a conflict', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => ({ receiptId: 'AOI-OLD', pageId: 'p' })), enforceRateLimits: vi.fn(), create: vi.fn() };
    const res = await handleContactIntake(req(), deps({ config, store, now }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'idempotency_conflict' });
  });

  it('stops a local burst before Turnstile and Notion', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(), enforceRateLimits: vi.fn(), create: vi.fn() };
    const fetcher = vi.fn() as unknown as typeof fetch;
    const res = await handleContactIntake(req(), { config, store, fetcher, now, preLimiter: { check: () => ({ allowed: false, retryAfter: 42 }) }, limiter: allowLimiter });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it('keeps the fast-submit hard reject until Turnstile is mandatory', async () => {
    const fast = body();
    fast.antiSpam.formStartedAt = now().getTime() - 100;
    const response = await handleContactIntake(req(fast), deps({ config, now }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fields: { 'antiSpam.formStartedAt': 'submitted_too_quickly' } });
  });

  it('does not consume distributed counters before Turnstile succeeds', async () => {
    const distributedLimiter = { check: vi.fn(async () => ({ allowed: true as const })) };
    const postLimiter = { check: vi.fn(() => ({ allowed: true as const })) };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] })));
    const response = await handleContactIntake(req(), {
      config: { ...config, requireTurnstile: true, turnstileSiteKey: 'site', turnstileSecretKey: 'secret' }, now,
      preLimiter: allowLimiter, limiter: postLimiter, distributedLimiter, fetcher,
    });
    expect(response.status).toBe(400);
    expect(postLimiter.check).not.toHaveBeenCalled();
    expect(distributedLimiter.check).not.toHaveBeenCalled();
  });

  it('fails closed when distributed protection is required, unavailable, or over limit', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(), enforceRateLimits: vi.fn(), create: vi.fn() };
    const required = await handleContactIntake(req(), deps({ config: { ...config, requireDistributedLimit: true }, store, now }));
    expect(required.status).toBe(503);
    const weakSecret = await handleContactIntake(req(), deps({ config: { ...config, requireDistributedLimit: true, distributedLimitUrl: 'https://redis.example', distributedLimitToken: 'token', distributedLimitHashSecret: 'short', distributedLimitNamespace: 'production' }, store, now }));
    expect(weakSecret.status).toBe(503);
    const unavailable = await handleContactIntake(req(), { config, store, now, preLimiter: allowLimiter, limiter: allowLimiter, distributedLimiter: { check: async () => ({ allowed: false, unavailable: true }) } });
    expect(unavailable.status).toBe(503);
    const limited = await handleContactIntake(req(), { config, store, now, preLimiter: allowLimiter, limiter: allowLimiter, distributedLimiter: { check: async () => ({ allowed: false, retryAfter: 17 }) } });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('17');
    const breaker = await handleContactIntake(req(), { config, store, now, preLimiter: allowLimiter, limiter: allowLimiter, distributedLimiter: { check: async () => ({ allowed: false, retryAfter: 86400, breaker: true }) } });
    expect(breaker.status).toBe(503);
    expect(await breaker.json()).toEqual({ error: 'intake_temporarily_paused' });
    expect(store.findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it('uses Redis as the rate backend without Notion rate queries', async () => {
    const store: any = {
      findByIdempotencyKey: vi.fn(async () => null), enforceRateLimits: vi.fn(),
      create: vi.fn(async () => ({ receiptId: 'AOI-REDIS', pageId: 'p' })),
    };
    const response = await handleContactIntake(req(), {
      config, store, now, receipt: () => 'AOI-REDIS', preLimiter: allowLimiter, limiter: allowLimiter,
      distributedLimiter: { check: async () => ({ allowed: true }) },
    });
    expect(response.status).toBe(201);
    expect(store.enforceRateLimits).not.toHaveBeenCalled();
  });

  it('returns 429 and 503 without a success receipt', async () => {
    const limited: any = { findByIdempotencyKey: async () => null, enforceRateLimits: async () => ({ allowed: false, reason: 'global_hourly_limit' }) };
    const limitedResponse = await handleContactIntake(req(), deps({ config, store: limited, now }));
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('retry-after')).toBe('3600');
    const down: any = { findByIdempotencyKey: vi.fn(async () => null), enforceRateLimits: async () => ({ allowed: true }), create: async () => { throw new Error('down'); } };
    const res = await handleContactIntake(req(), deps({ config, store: down, now }));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('receiptId');
  });
});
