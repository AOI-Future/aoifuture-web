import { addBusinessDays, notionStageLabels, type ConsultationIntake } from './consultation-intake';

export type NotionConfig = { apiKey: string; dataSourceId: string; apiVersion?: string };
export type StoredConsultation = { receiptId: string; pageId: string; url?: string };

type NotionPage = { id: string; url?: string; properties?: Record<string, { rich_text?: Array<{ plain_text?: string }> }> };

export class NotionConsultationStore {
  private readonly base = 'https://api.notion.com/v1';
  constructor(private config: NotionConfig, private fetcher: typeof fetch = fetch) {}

  private headers() { return { Authorization: `Bearer ${this.config.apiKey}`, 'Notion-Version': this.config.apiVersion || '2025-09-03', 'Content-Type': 'application/json' }; }

  private async request(path: string, init: RequestInit, retry = true): Promise<Response> {
    let response: Response;
    try { response = await this.fetcher(`${this.base}${path}`, { ...init, headers: { ...this.headers(), ...(init.headers || {}) }, signal: AbortSignal.timeout(8_000) }); }
    catch { throw new Error('notion_unavailable'); }
    if (response.status === 429 && retry) {
      const waitMs = Math.min(2_000, Math.max(50, Number(response.headers.get('retry-after') || '0.1') * 1000));
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this.request(path, init, false);
    }
    if (!response.ok) throw new Error(response.status >= 500 ? 'notion_unavailable' : 'notion_rejected');
    return response;
  }

  private async query(filter: Record<string, unknown>, pageSize = 10): Promise<NotionPage[]> {
    const response = await this.request(`/data_sources/${this.config.dataSourceId}/query`, { method: 'POST', body: JSON.stringify({ filter, page_size: pageSize }) });
    const data = await response.json() as { results?: NotionPage[] };
    return data.results || [];
  }

  async findByIdempotencyKey(key: string): Promise<StoredConsultation | null> {
    const pages = await this.query({ property: 'Idempotency Key', rich_text: { equals: key } }, 1);
    const page = pages[0];
    if (!page) return null;
    const receiptId = page.properties?.['Receipt ID']?.rich_text?.map(x => x.plain_text || '').join('') || '';
    return receiptId ? { receiptId, pageId: page.id, url: page.url } : null;
  }

  async enforceRateLimits(email: string, now: Date, limits = { emailPerDay: 3, globalPerHour: 30 }): Promise<{ allowed: boolean; reason?: string }> {
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const hourStart = new Date(now.getTime() - 60 * 60 * 1000);
    const [emailPages, globalPages] = await Promise.all([
      this.query({ and: [
        { property: 'Email', email: { equals: email.toLowerCase() } },
        { property: 'Received At', date: { on_or_after: dayStart.toISOString() } },
      ] }, limits.emailPerDay),
      this.query({ property: 'Received At', date: { on_or_after: hourStart.toISOString() } }, limits.globalPerHour),
    ]);
    if (emailPages.length >= limits.emailPerDay) return { allowed: false, reason: 'email_daily_limit' };
    if (globalPages.length >= limits.globalPerHour) return { allowed: false, reason: 'global_hourly_limit' };
    return { allowed: true };
  }

  async create(input: ConsultationIntake, receiptId: string, receivedAt: Date): Promise<StoredConsultation> {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
    const rich = (content: string) => ({ rich_text: [{ type: 'text', text: { content } }] });
    const due = addBusinessDays(receivedAt, 2);
    const retention = new Date(receivedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const properties: Record<string, unknown> = {
      Name: { title: [{ type: 'text', text: { content: `${receiptId} / ${input.displayName || 'ご相談者さま'}` } }] },
      Status: { select: { name: 'New' } }, Priority: { select: { name: 'P2' } }, Owner: rich('Shugo'),
      'Next Action': rich('内容を確認し、1〜2営業日以内に返信'), 'Next Action Due': { date: { start: due.toISOString() } },
      Stage: { select: { name: notionStageLabels[input.stage] } }, Email: { email: input.email.toLowerCase() },
      Situation: rich(input.situation), 'Receipt ID': rich(receiptId), 'Idempotency Key': rich(input.idempotencyKey),
      Source: { select: { name: input.source === 'consulting_page' ? 'aoifuture.com/consulting/intake' : 'manual' } }, 'Received At': { date: { start: receivedAt.toISOString() } },
      'Last Contact': { date: { start: receivedAt.toISOString() } }, 'Retention Review At': { date: { start: retention.toISOString() } },
      'Consent Version': rich(input.consent.version), 'Notification Status': { select: { name: 'Notion' } },
      'Security Flags': { multi_select: [] },
    };
    if (input.desiredTakeaway) properties['Desired Takeaway'] = rich(input.desiredTakeaway);
    if (input.displayName) properties['Display Name'] = rich(input.displayName);
    if (input.organization) properties.Organization = rich(input.organization);
    const response = await this.request('/pages', { method: 'POST', body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: this.config.dataSourceId }, properties }) });
    const page = await response.json() as NotionPage;
    return { receiptId, pageId: page.id, url: page.url };
  }
}
