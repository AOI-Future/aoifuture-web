import { describe, expect, it, vi } from 'vitest';
import { NotionConsultationStore } from '../src/lib/notion-consultation';

const input: any = { idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', source: 'nozaki.com', inquiryType: 'Article Question / Correction', situation: 'An article needs a correction', desiredTakeaway: 'A decision', displayName: 'Test Person', email: 'Test@Example.com', organization: 'Test Team', articleUrl: 'https://nozaki.com/article', consent: { version: '2026-07-14' } };

describe('Notion shared contact store', () => {
  it('maps shared properties, Pending notification and data source parent', async () => {
    const calls: Array<{ url: string, init: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init || {} });
      if (String(url).includes('/query')) return new Response(JSON.stringify({ results: [] }));
      return new Response(JSON.stringify({ id: 'page-1', url: 'https://notion.so/page-1' }));
    }) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'secret', dataSourceId: 'ds' }, fetcher);
    const out = await store.create(input, 'AOI-12345678', new Date('2026-07-17T10:00:00Z'));
    expect(out.pageId).toBe('page-1');
    const create = calls.find(x => x.url.endsWith('/pages'))!;
    const body = JSON.parse(String(create.init.body));
    expect(body.parent).toEqual({ type: 'data_source_id', data_source_id: 'ds' });
    expect(body.properties.Source.select.name).toBe('nozaki.com');
    expect(body.properties['Inquiry Type'].select.name).toBe('Article Question / Correction');
    expect(body.properties['Article URL'].url).toBe('https://nozaki.com/article');
    expect(body.properties['Notification Status'].select.name).toBe('Pending');
    expect(body.properties['Payload Fingerprint'].rich_text[0].text.content).toMatch(/^[0-9a-f]{64}$/);
    expect(body.properties.Name.title[0].text.content).toBe('AOI-12345678 / Article Question / Correction');
    expect(JSON.stringify(body.properties.Name)).not.toContain('Test Person');
    expect(body.properties.Stage).toBeUndefined();
    expect(body.properties.Owner.rich_text[0].text.content).toBe('Shugo');
    expect(body.properties['Next Action Due'].date.start).toBe('2026-07-21T10:00:00.000Z');
    expect(body.properties['Retention Review At'].date.start).toBe('2026-10-15T10:00:00.000Z');
    expect(body.properties.Email.email).toBe('test@example.com');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('maps quarantined intake to Triaging with allowlisted security flags', async () => {
    const calls: RequestInit[] = [];
    const fetcher = vi.fn(async (url: any, init?: RequestInit) => {
      if (String(url).includes('/query')) return new Response(JSON.stringify({ results: [] }));
      calls.push(init || {});
      return new Response(JSON.stringify({ id: 'p' }));
    }) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'secret', dataSourceId: 'ds' }, fetcher);
    await store.create(input, 'AOI-QUARANTINE', new Date('2026-07-17T10:00:00Z'), { flags: ['Fast submit', 'Many links'], quarantine: true });
    const properties = JSON.parse(String(calls[0].body)).properties;
    expect(properties.Status.select.name).toBe('Triaging');
    expect(properties.Priority.select.name).toBe('P3');
    expect(properties['Security Flags'].multi_select).toEqual([{ name: 'Fast submit' }, { name: 'Many links' }]);
    expect(properties['Next Action'].rich_text[0].text.content).toContain('安全性を確認');
  });

  it('maps stage for the detailed work-consultation flow', async () => {
    const calls: RequestInit[] = [];
    const fetcher = vi.fn(async (url: any, init?: RequestInit) => {
      if (String(url).includes('/query')) return new Response(JSON.stringify({ results: [] }));
      calls.push(init || {});
      return new Response(JSON.stringify({ id: 'p' }));
    }) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'k', dataSourceId: 'ds' }, fetcher);
    await store.create({ ...input, source: 'aoifuture.com/consulting/intake', inquiryType: 'Work Consultation', stage: 'workflow_review' }, 'AOI-WORK', new Date('2026-07-17T10:00:00Z'));
    expect(JSON.parse(String(calls[0].body)).properties.Stage.select.name).toBe('Workflow review');
  });

  it('stores attribution as a deterministic child without assuming a Notion property', async () => {
    const calls: RequestInit[] = [];
    const fetcher = vi.fn(async (url: any, init?: RequestInit) => {
      if (String(url).includes('/query')) return new Response(JSON.stringify({ results: [] }));
      calls.push(init || {});
      return new Response(JSON.stringify({ id: 'p' }));
    }) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'secret', dataSourceId: 'ds' }, fetcher);
    await store.create({ ...input, source: 'aoifuture.com/consulting/intake', inquiryType: 'Work Consultation', stage: 'workflow_review', attribution: {
      cellId: 'cell-1', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'agent_security', entryPath: '/agent-security/verification-support/', offer: 'sprint',
    } }, 'AOI-ATTR', new Date('2026-07-17T10:00:00Z'));
    const body = JSON.parse(String(calls[0].body));
    expect(body.properties.Attribution).toBeUndefined();
    expect(body.properties.Situation.rich_text[0].text.content).toBe('An article needs a correction');
    expect(body.children).toEqual([{ object: 'block', type: 'code', code: { language: 'json', rich_text: [{ type: 'text', text: { content: '{"schema":"aoi-intake-attribution-v1","cellId":"cell-1","utmSource":"google","utmMedium":"cpc","utmCampaign":"agent_security","entryPath":"/agent-security/verification-support/","offer":"sprint"}' } }] } }]);
  });

  it('returns existing receipt without create when the semantic payload matches', async () => {
    let fingerprint = '';
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 'p', url: 'u', created_time: '2026-07-14T00:00:00Z', properties: { 'Receipt ID': { rich_text: [{ plain_text: 'AOI-OLD' }] }, 'Payload Fingerprint': { rich_text: [{ plain_text: fingerprint }] } } }] }))) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'k', dataSourceId: 'ds' }, fetcher);
    fingerprint = store.payloadFingerprint(input);
    await expect(store.create(input, 'AOI-NEW', new Date())).resolves.toMatchObject({ receiptId: 'AOI-OLD' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reconciles a concurrent duplicate to the deterministic earliest page', async () => {
    let queryCount = 0;
    let fingerprint = '';
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/query')) {
        queryCount++;
        if (queryCount === 1) return new Response(JSON.stringify({ results: [] }));
        return new Response(JSON.stringify({ results: [
          { id: 'page-new', url: 'new', created_time: '2026-07-14T12:00:01Z', properties: { 'Receipt ID': { rich_text: [{ plain_text: 'AOI-NEW' }] }, 'Payload Fingerprint': { rich_text: [{ plain_text: fingerprint }] } } },
          { id: 'page-canonical', url: 'canonical', created_time: '2026-07-14T12:00:00Z', properties: { 'Receipt ID': { rich_text: [{ plain_text: 'AOI-CANONICAL' }] }, 'Payload Fingerprint': { rich_text: [{ plain_text: fingerprint }] } } },
        ] }));
      }
      if (path.endsWith('/pages')) return new Response(JSON.stringify({ id: 'page-new', url: 'new', created_time: '2026-07-14T12:00:01Z' }));
      if (path.endsWith('/pages/page-new')) return new Response(JSON.stringify({ id: 'page-new', in_trash: true }));
      throw new Error(`unexpected request: ${path} ${init?.method}`);
    }) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'k', dataSourceId: 'ds' }, fetcher);
    fingerprint = store.payloadFingerprint(input);

    await expect(store.create(input, 'AOI-NEW', new Date('2026-07-14T12:00:01Z'))).resolves.toMatchObject({
      receiptId: 'AOI-CANONICAL', pageId: 'page-canonical', payloadFingerprint: fingerprint,
    });
    const trashCall = fetcher.mock.calls.find(([url]) => String(url).endsWith('/pages/page-new'));
    expect(trashCall).toBeDefined();
    expect(JSON.parse(String(trashCall?.[1]?.body))).toEqual({ in_trash: true });
  });

  it('queries email/day and global/hour limits', async () => {
    const fetcher = vi.fn(async (_url: any, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body));
      const isEmail = JSON.stringify(requestBody).includes('Email');
      return new Response(JSON.stringify({ results: Array(isEmail ? 3 : 0).fill({ id: 'p' }) }));
    }) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'k', dataSourceId: 'ds' }, fetcher);
    await expect(store.enforceRateLimits('test@example.com', new Date('2026-07-14T12:00:00Z'))).resolves.toEqual({ allowed: false, reason: 'email_daily_limit' });
  });

  it('retries one 429 without leaking response bodies', async () => {
    let count = 0;
    const fetcher = vi.fn(async () => ++count === 1 ? new Response('', { status: 429, headers: { 'retry-after': '0' } }) : new Response(JSON.stringify({ results: [] }))) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'k', dataSourceId: 'ds' }, fetcher);
    await expect(store.findByIdempotencyKey('key')).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
