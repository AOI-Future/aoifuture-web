import { addBusinessDays, notionStageLabels, type ConsultationIntake } from './consultation-intake';
import { contactPayloadFingerprint } from './consultation-fingerprint';
import type { IntakeSecurityAssessment } from './consultation-security-signals';

export type NotionConfig = { apiKey: string; dataSourceId: string; apiVersion?: string };
export type StoredConsultation = { receiptId: string; pageId: string; url?: string; payloadFingerprint?: string; createdTime?: string };

type NotionPage = {
  id: string;
  url?: string;
  created_time?: string;
  properties?: Record<string, { rich_text?: Array<{ plain_text?: string }> }>;
};

export class IdempotencyConflictError extends Error {
  constructor() { super('idempotency_conflict'); this.name = 'IdempotencyConflictError'; }
}

export class NotionConsultationStore {
  private readonly base = 'https://api.notion.com/v1';
  constructor(private config: NotionConfig, private fetcher: typeof fetch = fetch) {}

  payloadFingerprint(input: ConsultationIntake): string { return contactPayloadFingerprint(input); }

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

  private storedFromPage(page: NotionPage): StoredConsultation | null {
    const receiptId = page.properties?.['Receipt ID']?.rich_text?.map(x => x.plain_text || '').join('') || '';
    if (!receiptId) return null;
    const payloadFingerprint = page.properties?.['Payload Fingerprint']?.rich_text?.map(x => x.plain_text || '').join('') || undefined;
    return { receiptId, pageId: page.id, url: page.url, payloadFingerprint, createdTime: page.created_time };
  }

  private canonical(pages: StoredConsultation[]): StoredConsultation | null {
    return [...pages].sort((a, b) => {
      const byTime = (a.createdTime || '9999').localeCompare(b.createdTime || '9999');
      return byTime || a.pageId.localeCompare(b.pageId);
    })[0] || null;
  }

  private async findAllByIdempotencyKey(key: string): Promise<StoredConsultation[]> {
    const pages = await this.query({ property: 'Idempotency Key', rich_text: { equals: key } }, 100);
    return pages.map(page => this.storedFromPage(page)).filter((page): page is StoredConsultation => page !== null);
  }

  async findByIdempotencyKey(key: string): Promise<StoredConsultation | null> {
    return this.canonical(await this.findAllByIdempotencyKey(key));
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

  async create(input: ConsultationIntake, receiptId: string, receivedAt: Date, security: IntakeSecurityAssessment = { flags: [], quarantine: false }): Promise<StoredConsultation> {
    const payloadFingerprint = this.payloadFingerprint(input);
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.payloadFingerprint !== payloadFingerprint) throw new IdempotencyConflictError();
      return existing;
    }
    const rich = (content: string) => ({ rich_text: [{ type: 'text', text: { content } }] });
    const due = addBusinessDays(receivedAt, 2);
    const retention = new Date(receivedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const properties: Record<string, unknown> = {
      Name: { title: [{ type: 'text', text: { content: `${receiptId} / ${input.inquiryType}` } }] },
      Status: { select: { name: security.quarantine ? 'Triaging' : 'New' } }, Priority: { select: { name: security.quarantine ? 'P3' : 'P2' } }, Owner: rich('Shugo'),
      'Next Action': rich(security.quarantine ? '安全性を確認し、正規問い合わせの場合のみ返信' : '内容を確認し、1〜2営業日以内に返信'), 'Next Action Due': { date: { start: due.toISOString() } },
      Email: { email: input.email.toLowerCase() },
      Situation: rich(input.situation), 'Receipt ID': rich(receiptId), 'Idempotency Key': rich(input.idempotencyKey),
      'Payload Fingerprint': rich(payloadFingerprint),
      Source: { select: { name: input.source } }, 'Inquiry Type': { select: { name: input.inquiryType } }, 'Received At': { date: { start: receivedAt.toISOString() } },
      'Last Contact': { date: { start: receivedAt.toISOString() } }, 'Retention Review At': { date: { start: retention.toISOString() } },
      'Consent Version': rich(input.consent.version), 'Notification Status': { select: { name: 'Pending' } },
      'Security Flags': { multi_select: security.flags.map(name => ({ name })) },
    };
    if (input.stage) properties.Stage = { select: { name: notionStageLabels[input.stage] } };
    if (input.desiredTakeaway) properties['Desired Takeaway'] = rich(input.desiredTakeaway);
    if (input.displayName) properties['Display Name'] = rich(input.displayName);
    if (input.organization) properties.Organization = rich(input.organization);
    if (input.articleUrl) properties['Article URL'] = { url: input.articleUrl };
    const response = await this.request('/pages', { method: 'POST', body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: this.config.dataSourceId }, properties }) });
    const page = await response.json() as NotionPage;
    if (!page.id) throw new Error('notion_rejected');
    const created: StoredConsultation = { receiptId, pageId: page.id, url: page.url, payloadFingerprint, createdTime: page.created_time || receivedAt.toISOString() };

    // Notion has no unique constraint. Re-read after create and converge racing writers on
    // the earliest page; trash only the page created by this request when it lost the race.
    const candidates = await this.findAllByIdempotencyKey(input.idempotencyKey);
    if (!candidates.some(candidate => candidate.pageId === created.pageId)) candidates.push(created);
    const canonical = this.canonical(candidates) || created;
    if (canonical.pageId !== created.pageId) {
      try { await this.request(`/pages/${created.pageId}`, { method: 'PATCH', body: JSON.stringify({ in_trash: true }) }); }
      catch { /* best-effort reconciliation; the canonical receipt remains authoritative */ }
      if (canonical.payloadFingerprint !== payloadFingerprint) throw new IdempotencyConflictError();
      return canonical;
    }
    return created;
  }
}
