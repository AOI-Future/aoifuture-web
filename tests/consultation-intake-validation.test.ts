import { describe, expect, it } from 'vitest';
import { addBusinessDays, validateContactIntake } from '../src/lib/consultation-intake';

const now = Date.parse('2026-07-14T12:00:00Z');
const valid = () => ({
  schemaVersion: '2026-07-14',
  idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
  source: 'aoifuture.com/consulting/intake',
  inquiryType: 'Work Consultation',
  stage: 'workflow_review',
  situation: '\r\nA\u0000 situation\r\n',
  email: ' Person@Example.com ',
  consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' },
  antiSpam: { turnstileToken: '', website: '', formStartedAt: now - 4000 },
});

describe('shared contact intake schema', () => {
  it('normalizes bounded work consultation input', () => {
    const result = validateContactIntake(valid(), now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.situation).toBe('A situation');
      expect(result.value.email).toBe('Person@Example.com');
      expect(result.value.source).toBe('aoifuture.com/consulting/intake');
      expect(result.value.inquiryType).toBe('Work Consultation');
    }
  });

  it.each([['source', 'bad'], ['inquiryType', 'bad'], ['situation', ''], ['email', 'bad']])('rejects invalid %s', (key, value) => {
    expect(validateContactIntake({ ...valid(), [key]: value }, now).ok).toBe(false);
  });

  it('requires stage only for the detailed AOI work consultation flow', () => {
    expect(validateContactIntake({ ...valid(), stage: undefined }, now)).toMatchObject({ ok: false, errors: { stage: 'required' } });
    const generic = { ...valid(), source: 'nozaki.com', inquiryType: 'Writing / Contribution', stage: undefined, articleUrl: 'https://nozaki.com/article' };
    const result = validateContactIntake(generic, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toHaveProperty('stage');
  });

  it('accepts every shared source and inquiry type', () => {
    const sources = ['aoifuture.com/consulting/intake', 'aoifuture.com/contact', 'nozaki.com', 'wfhradio.tokyo', 'dispatch.aoifuture.com', 'direct', 'manual'];
    const types = ['Work Consultation', 'Writing / Contribution', 'Interview / Speaking', 'Music / Creative', 'Article Question / Correction', 'AOI Future / NICTIA', 'General / Other'];
    for (const source of sources) expect(validateContactIntake({ ...valid(), source, ...(source === 'aoifuture.com/consulting/intake' ? {} : { stage: undefined }) }, now).ok).toBe(true);
    for (const inquiryType of types) expect(validateContactIntake({ ...valid(), inquiryType }, now).ok).toBe(true);
  });

  it('validates article URL and rejects unknown fields', () => {
    expect(validateContactIntake({ ...valid(), articleUrl: 'javascript:alert(1)' }, now)).toMatchObject({ ok: false, errors: { articleUrl: 'invalid_url' } });
    expect(validateContactIntake({ ...valid(), articleUrl: `https://example.com/${'x'.repeat(481)}` }, now)).toMatchObject({ ok: false, errors: { articleUrl: 'too_long' } });
    expect(validateContactIntake({ ...valid(), extra: true }, now)).toMatchObject({ ok: false, errors: { extra: 'unknown_field' } });
    expect(validateContactIntake({ ...valid(), consent: { ...valid().consent, extra: true } }, now)).toMatchObject({ ok: false, errors: { 'consent.extra': 'unknown_field' } });
  });

  it('enforces limits, consent, honeypot and dwell', () => {
    expect(validateContactIntake({ ...valid(), situation: 'x'.repeat(801) }, now).ok).toBe(false);
    expect(validateContactIntake({ ...valid(), consent: { ...valid().consent, noSensitiveData: false } }, now).ok).toBe(false);
    expect(validateContactIntake({ ...valid(), antiSpam: { ...valid().antiSpam, website: 'bot' } }, now).ok).toBe(false);
    expect(validateContactIntake({ ...valid(), antiSpam: { ...valid().antiSpam, formStartedAt: now - 10 } }, now).ok).toBe(false);
  });

  it('adds business days', () => expect(addBusinessDays(new Date('2026-07-17T10:00:00Z'), 2).toISOString()).toBe('2026-07-21T10:00:00.000Z'));
});
