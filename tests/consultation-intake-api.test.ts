import { describe, expect, it, vi } from 'vitest';
import { getConsultationConfig } from '../src/lib/consultation-config';
import { handleContactIntake, handleConsultationIntake } from '../src/pages/api/consultation-intake';

const config: any = { enabled: true, fallbackUrl: 'https://fallback.test', allowedOrigins: ['https://aoifuture.com'], allowedHostnames: ['aoifuture.com'], turnstileSiteKey: '', turnstileSecretKey: '', requireTurnstile: false, notionApiKey: 'k', notionDataSourceId: 'd', notionApiVersion: '2025-09-03' };
const body = () => ({ schemaVersion: '2026-07-14', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', source: 'aoifuture.com/contact', inquiryType: 'General / Other', situation: 'A real workflow problem', email: 'test@example.com', consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' }, antiSpam: { turnstileToken: '', website: '', formStartedAt: Date.parse('2026-07-14T11:59:50Z') } });
const req = (payload: any = body(), headers: Record<string, string> = {}) => new Request('https://aoifuture.com/api/contact-intake', { method: 'POST', headers: { origin: 'https://aoifuture.com', 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
const now = () => new Date('2026-07-14T12:00:00Z');

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
    expect((await handleContactIntake(req({ ...body(), extra: true }), { config, now })).status).toBe(400);
  });

  it('rejects a mismatched Idempotency-Key header', async () => {
    expect((await handleContactIntake(req(body(), { 'idempotency-key': 'different' }), { config, now })).status).toBe(409);
  });

  it('rejects a source that does not match the public origin', async () => {
    expect((await handleContactIntake(req({ ...body(), source: 'wfhradio.tokyo' }), { config, now })).status).toBe(400);
    expect((await handleContactIntake(req({ ...body(), source: 'manual' }), { config, now })).status).toBe(400);
  });

  it('returns created only after store create', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => null), enforceRateLimits: vi.fn(async () => ({ allowed: true })), create: vi.fn(async () => ({ receiptId: 'AOI-TEST0001', pageId: 'p' })) };
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const res = await handleContactIntake(req({ ...body(), displayName: 'Private Person', email: 'private@example.com', organization: 'Private Org' }), { config, store, now, receipt: () => 'AOI-TEST0001' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, receiptId: 'AOI-TEST0001', duplicate: false });
    expect(store.create).toHaveBeenCalledOnce();
    const serializedLog = String(log.mock.calls[0][0]);
    expect(serializedLog).toContain('"source":"aoifuture.com/contact"');
    expect(serializedLog).toContain('"inquiryType":"General / Other"');
    expect(serializedLog).not.toMatch(/Private Person|private@example.com|Private Org/);
    log.mockRestore();
  });

  it('returns durable duplicate and skips rate/create', async () => {
    const store: any = { findByIdempotencyKey: vi.fn(async () => ({ receiptId: 'AOI-OLD', pageId: 'p' })), enforceRateLimits: vi.fn(), create: vi.fn() };
    const res = await handleContactIntake(req(), { config, store, now });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true, receiptId: 'AOI-OLD' });
    expect(store.create).not.toHaveBeenCalled();
  });

  it('returns 429 and 503 without a success receipt', async () => {
    const limited: any = { findByIdempotencyKey: async () => null, enforceRateLimits: async () => ({ allowed: false, reason: 'global_hourly_limit' }) };
    expect((await handleContactIntake(req(), { config, store: limited, now })).status).toBe(429);
    const down: any = { findByIdempotencyKey: vi.fn(async () => null), enforceRateLimits: async () => ({ allowed: true }), create: async () => { throw new Error('down'); } };
    const res = await handleContactIntake(req(), { config, store: down, now });
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('receiptId');
  });
});
