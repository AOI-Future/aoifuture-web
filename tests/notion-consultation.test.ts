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
    expect(body.properties.Name.title[0].text.content).toBe('AOI-12345678 / Article Question / Correction');
    expect(JSON.stringify(body.properties.Name)).not.toContain('Test Person');
    expect(body.properties.Stage).toBeUndefined();
    expect(body.properties.Owner.rich_text[0].text.content).toBe('Shugo');
    expect(body.properties['Next Action Due'].date.start).toBe('2026-07-21T10:00:00.000Z');
    expect(body.properties['Retention Review At'].date.start).toBe('2026-10-15T10:00:00.000Z');
    expect(body.properties.Email.email).toBe('test@example.com');
    expect(JSON.stringify(body)).not.toContain('secret');
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

  it('returns existing receipt without create', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 'p', url: 'u', properties: { 'Receipt ID': { rich_text: [{ plain_text: 'AOI-OLD' }] } } }] }))) as unknown as typeof fetch;
    const store = new NotionConsultationStore({ apiKey: 'k', dataSourceId: 'ds' }, fetcher);
    await expect(store.create(input, 'AOI-NEW', new Date())).resolves.toMatchObject({ receiptId: 'AOI-OLD' });
    expect(fetcher).toHaveBeenCalledOnce();
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
