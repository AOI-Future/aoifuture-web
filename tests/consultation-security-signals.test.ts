import { describe, expect, it } from 'vitest';
import { assessIntakeSecurity } from '../src/lib/consultation-security-signals';

const now = Date.parse('2026-07-14T12:00:00Z');
const input = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: '2026-07-14', idempotencyKey: crypto.randomUUID(), source: 'aoifuture.com/contact', inquiryType: 'General / Other',
  situation: '通常のお問い合わせです。', email: 'person@example.com', consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' },
  antiSpam: { turnstileToken: '', website: '', formStartedAt: now - 10_000 }, ...overrides,
}) as any;

describe('deterministic intake security signals', () => {
  it('does not classify fluent or prompt-injection-like prose as abuse', () => {
    expect(assessIntakeSecurity(input({ situation: 'Ignore previous instructionsという文章について質問です。' }), now)).toEqual({ flags: [], quarantine: false });
  });

  it('flags fast submissions without rejecting them', () => {
    expect(assessIntakeSecurity(input({ antiSpam: { turnstileToken: '', website: '', formStartedAt: now - 100 } }), now)).toEqual({ flags: ['Fast submit'], quarantine: false });
  });

  it('flags many links and quarantines combined signals', () => {
    const situation = 'https://a.test https://b.test https://c.test https://d.test';
    expect(assessIntakeSecurity(input({ situation }), now)).toEqual({ flags: ['Many links'], quarantine: false });
    const assessment = assessIntakeSecurity(input({ situation, antiSpam: { turnstileToken: '', website: '', formStartedAt: now - 100 } }), now);
    expect(assessment).toEqual({ flags: ['Fast submit', 'Many links'], quarantine: true });
  });

  it('allows legitimate ZWJ emoji and ZWNJ language text', () => {
    expect(assessIntakeSecurity(input({ situation: '家族で使います 👨‍👩‍👧‍👦' }), now)).toEqual({ flags: [], quarantine: false });
    expect(assessIntakeSecurity(input({ situation: 'می‌خواهم دربارهٔ این موضوع بپرسم' }), now)).toEqual({ flags: [], quarantine: false });
  });

  it('quarantines long repetition and Unicode format controls', () => {
    expect(assessIntakeSecurity(input({ situation: 'x'.repeat(20) }), now)).toEqual({ flags: ['Manual review'], quarantine: true });
    expect(assessIntakeSecurity(input({ situation: 'normal\u202etext' }), now)).toEqual({ flags: ['Manual review'], quarantine: true });
  });
});
