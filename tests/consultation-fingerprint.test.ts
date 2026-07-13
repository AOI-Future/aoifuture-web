import { describe, expect, it } from 'vitest';
import { contactPayloadFingerprint } from '../src/lib/consultation-fingerprint';
import type { ContactIntake } from '../src/lib/consultation-intake';

const intake: ContactIntake = {
  schemaVersion: '2026-07-14',
  idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
  source: 'aoifuture.com/consulting/intake',
  inquiryType: 'Work Consultation',
  stage: 'workflow_review',
  situation: 'Current situation',
  desiredTakeaway: 'Desired decision',
  displayName: 'Test Person',
  email: 'Test@Example.com',
  organization: 'Test Org',
  articleUrl: 'https://example.com/article',
  consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' },
  antiSpam: { turnstileToken: 'token-a', website: '', formStartedAt: 1 },
};

describe('contact payload fingerprint', () => {
  it('excludes idempotency and anti-abuse token, honeypot, and timing values', () => {
    const changed = {
      ...intake,
      idempotencyKey: '223e4567-e89b-42d3-a456-426614174000',
      antiSpam: { turnstileToken: 'token-b', website: 'bot-value', formStartedAt: 999 },
    };
    expect(contactPayloadFingerprint(changed)).toBe(contactPayloadFingerprint(intake));
  });

  it.each([
    ['source', 'aoifuture.com/contact'],
    ['inquiryType', 'General / Other'],
    ['stage', 'moving_to_operation'],
    ['situation', 'Changed situation'],
    ['desiredTakeaway', 'Changed takeaway'],
    ['displayName', 'Changed Person'],
    ['email', 'changed@example.com'],
    ['organization', 'Changed Org'],
    ['articleUrl', 'https://example.com/changed'],
  ] as const)('includes %s', (field, value) => {
    expect(contactPayloadFingerprint({ ...intake, [field]: value } as ContactIntake)).not.toBe(contactPayloadFingerprint(intake));
  });

  it('includes the consent version', () => {
    const changed = { ...intake, consent: { ...intake.consent, version: 'future-version' } } as unknown as ContactIntake;
    expect(contactPayloadFingerprint(changed)).not.toBe(contactPayloadFingerprint(intake));
  });

  it('uses the normalized email semantics stored by Notion', () => {
    expect(contactPayloadFingerprint({ ...intake, email: 'test@example.com' })).toBe(contactPayloadFingerprint(intake));
  });
});
