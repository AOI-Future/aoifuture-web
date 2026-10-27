import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConsultationConfig, getContactConfigForOrigin } from '../src/lib/consultation-config';
import { handleContactIntake } from '../src/pages/api/consultation-intake';
import { POST as contactPost, OPTIONS as contactOptions } from '../src/pages/api/contact-intake';
import { POST as consultationPost } from '../src/pages/api/consultation-intake';
import type { NotionConsultationStore } from '../src/lib/notion-consultation';

const env = { NOZAKI_CONTACT_ENABLED: 'true', NOZAKI_TURNSTILE_SECRET_KEY: 'dedicated-test-secret' };
const base = getConsultationConfig({ NOTION_API_KEY: 'test-notion', NOTION_CONSULTATION_DATA_SOURCE_ID: 'test-data-source' });
const now = () => new Date('2026-10-27T12:00:00Z');
const payload = () => ({
  schemaVersion: '2026-07-14', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
  source: 'nozaki.com', inquiryType: 'General / Other', situation: 'Synthetic fixture', email: 'test@example.com',
  consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' },
  antiSpam: { turnstileToken: 'test-token', website: '', formStartedAt: now().getTime() - 10000 },
});
const request = (origin = 'https://nozaki.com', body = payload()) => new Request('https://www.aoifuture.com/api/contact-intake', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const storeFixture = () => ({
  findByIdempotencyKey: vi.fn(async () => null),
  enforceRateLimits: vi.fn(async () => ({ allowed: true })),
  create: vi.fn(async () => ({ receiptId: 'AOI-TEST', pageId: 'test-page' })),
});
const validResult = { success: true, hostname: 'nozaki.com', action: 'contact_intake' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('nozaki isolated policy', () => {
  it('ignores the shared enable/origin/secret settings for nozaki', () => {
    const shared = { ...base, enabled: false, allowedOrigins: ['https://aoifuture.com'], turnstileSecretKey: 'shared-test-secret' };
    expect(getContactConfigForOrigin('https://nozaki.com', shared, env)).toMatchObject({
      enabled: true, allowedOrigins: ['https://nozaki.com'], allowedHostnames: ['nozaki.com'],
      turnstileSecretKey: 'dedicated-test-secret', requireTurnstile: true, expectedAction: 'contact_intake', expectedHostname: 'nozaki.com',
      notionApiKey: 'test-notion', notionDataSourceId: 'test-data-source',
    });
    expect(shared.enabled).toBe(false);
  });

  it.each(['', 'TRUE', ' true', 'true ', 'yes', 'false', '0'])('does not enable on %j', value => {
    expect(getContactConfigForOrigin('https://nozaki.com', base, { ...env, NOZAKI_CONTACT_ENABLED: value }).enabled).toBe(false);
  });
  it.each(['true', '1'])('enables only exact %j', value => {
    expect(getContactConfigForOrigin('https://nozaki.com', base, { ...env, NOZAKI_CONTACT_ENABLED: value }).enabled).toBe(true);
  });

  it.each(['https://aoifuture.com', 'https://www.aoifuture.com', 'https://wfhradio.tokyo', 'https://www.wfhradio.tokyo', 'https://dispatch.aoifuture.com', 'https://preview.vercel.app', 'https://evil.test', 'null', null])('preserves the identical shared config for %j', origin => {
    expect(getContactConfigForOrigin(origin, base, env)).toBe(base);
  });

  it('selects the dedicated CORS policy before both endpoint preflights', async () => {
    for (const path of ['contact-intake', 'consultation-intake']) {
      const preflight = new Request(`https://www.aoifuture.com/api/${path}`, { method: 'OPTIONS', headers: { origin: 'https://nozaki.com' } });
      const result = await handleContactIntake(preflight, { config: base, env });
      expect(result.status).toBe(204);
      expect(result.headers.get('access-control-allow-origin')).toBe('https://nozaki.com');
    }
  });

  it.each(['https://www.nozaki.com', 'http://nozaki.com', 'https://nozaki.com:8443', 'https://user@nozaki.com'])('blocks noncanonical nozaki origin %j even if shared config allows it', async origin => {
    const fetcher = vi.fn();
    const result = await handleContactIntake(request(origin), { config: { ...base, enabled: true, allowedOrigins: [origin] }, env, fetcher });
    expect(result.status).toBe(403);
    expect(result.headers.has('access-control-allow-origin')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['disabled', { ...env, NOZAKI_CONTACT_ENABLED: 'false' }, '', 503, 'intake_disabled'],
    ['missing dedicated secret', { NOZAKI_CONTACT_ENABLED: 'true' }, 'test-token', 503, 'turnstile_not_configured'],
    ['missing token', env, '', 400, 'turnstile_token_missing'],
  ] as const)('fails closed for %s', async (_name, selectedEnv, token, status, error) => {
    const store = storeFixture();
    const body = payload(); body.antiSpam.turnstileToken = token;
    const fetcher = vi.fn();
    const result = await handleContactIntake(request('https://nozaki.com', body), { config: { ...base, turnstileSecretKey: 'shared-test-secret' }, env: selectedEnv, now, fetcher, store: store as unknown as NotionConsultationStore });
    expect(result.status).toBe(status);
    expect(await result.json()).toMatchObject({ error });
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it.each([
    { success: false }, { ...validResult, success: 'true' }, { ...validResult, action: 'other' },
    { success: true, hostname: 'nozaki.com' }, { ...validResult, hostname: 'www.nozaki.com' },
    { ...validResult, hostname: 'aoifuture.com' }, null,
  ])('does not access storage for invalid verification %j', async verification => {
    const store = storeFixture();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(verification))) as unknown as typeof fetch;
    const result = await handleContactIntake(request(), { config: base, env, now, fetcher, store: store as unknown as NotionConsultationStore });
    expect([400, 503]).toContain(result.status);
    expect(store.findByIdempotencyKey).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });

  it('fails closed during verification outage and source spoofing', async () => {
    const store = storeFixture();
    const fetcher = vi.fn(async () => { throw new Error('test outage'); });
    const result = await handleContactIntake(request(), { config: base, env, now, fetcher, store: store as unknown as NotionConsultationStore });
    expect(result.status).toBe(503);
    const body = payload(); body.source = 'aoifuture.com/contact';
    const spoofed = await handleContactIntake(request('https://nozaki.com', body), { config: base, env, now, fetcher });
    expect(spoofed.status).toBe(400);
    expect(await spoofed.json()).toEqual({ error: 'source_origin_mismatch' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(store.create).not.toHaveBeenCalled();
  });

  it('verifies with the dedicated secret before accepting a valid request', async () => {
    const store = storeFixture();
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(String(init?.body)).toContain('secret=dedicated-test-secret');
      expect(String(init?.body)).not.toContain('shared-test-secret');
      return new Response(JSON.stringify(validResult));
    }) as unknown as typeof fetch;
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const result = await handleContactIntake(request(), { config: { ...base, turnstileSecretKey: 'shared-test-secret' }, env, now, fetcher, store: store as unknown as NotionConsultationStore, receipt: () => 'AOI-TEST' });
    expect(result.status).toBe(201);
    expect(store.create).toHaveBeenCalledOnce();
  });

  it.each([
    ['https://aoifuture.com', 'aoifuture.com/contact'], ['https://www.aoifuture.com', 'aoifuture.com/contact'],
    ['https://wfhradio.tokyo', 'wfhradio.tokyo'], ['https://www.wfhradio.tokyo', 'wfhradio.tokyo'],
    ['https://dispatch.aoifuture.com', 'dispatch.aoifuture.com'], ['https://preview.vercel.app', 'aoifuture.com/contact'],
  ])('preserves optional and existing-secret verification for %s', async (origin, source) => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    for (const secret of ['', 'shared-test-secret']) {
      const store = storeFixture();
      const body = payload(); body.source = source;
      const hostname = new URL(origin).hostname;
      const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, hostname }))) as unknown as typeof fetch;
      const result = await handleContactIntake(request(origin, body), {
        config: { ...base, enabled: true, allowedOrigins: [origin], allowedHostnames: [hostname], turnstileSecretKey: secret },
        env: { NOZAKI_CONTACT_ENABLED: 'false' }, now, fetcher, store: store as unknown as NotionConsultationStore, receipt: () => 'AOI-TEST',
      });
      expect(result.status).toBe(201);
      expect(store.create).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledTimes(secret ? 1 : 0);
    }
  });

  it('both public route wrappers fail closed without the dedicated switch', async () => {
    vi.stubEnv('NOZAKI_CONTACT_ENABLED', 'false');
    for (const route of [contactPost, consultationPost]) {
      const result = await route({ request: request() } as Parameters<typeof route>[0]);
      expect(result.status).toBe(503);
    }
    const result = await contactOptions({ request: new Request('https://www.aoifuture.com/api/contact-intake', { method: 'OPTIONS', headers: { origin: 'https://www.nozaki.com' } }) } as Parameters<typeof contactOptions>[0]);
    expect(result.status).toBe(403);
  });
});
