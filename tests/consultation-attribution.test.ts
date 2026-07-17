import { describe, expect, it } from 'vitest';
import { attributionFromQuery, attributionQuerySpecs, intakeAttributionFromQuery } from '../src/lib/intake-attribution';
import { validateContactIntake } from '../src/lib/consultation-intake';

const now = Date.parse('2026-07-18T00:00:00Z');
const valid = () => ({
  schemaVersion: '2026-07-14', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
  source: 'aoifuture.com/consulting/intake', inquiryType: 'Work Consultation', stage: 'workflow_review',
  situation: 'A real workflow problem', email: 'test@example.com',
  consent: { privacyPolicy: true, noSensitiveData: true, version: '2026-07-14' },
  antiSpam: { turnstileToken: '', website: '', formStartedAt: now - 10_000 },
});

describe('privacy-safe intake attribution', () => {
  it('accepts and normalizes the strict optional AOI attribution object', () => {
    const result = validateContactIntake({ ...valid(), attribution: {
      cellId: ' cell-01 ', utmSource: 'aoi\u0301\u0085', utmMedium: 'paid_search', utmCampaign: 'agent_security',
      utmContent: 'rsa_1', entryPath: '/agent-security/verification-support/', offer: 'sprint',
    } }, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.attribution).toEqual({ cellId: 'cell-01', utmSource: 'aoí', utmMedium: 'paid_search', utmCampaign: 'agent_security', utmContent: 'rsa_1', entryPath: '/agent-security/verification-support/', offer: 'sprint' });
  });

  it.each([
    [{ unknown: 'x' }, 'attribution.unknown', 'unknown_field'],
    [[], 'attribution', 'invalid_type'],
    [{ cellId: ['x'] }, 'attribution.cellId', 'invalid_type'],
    [{ offer: 'enterprise' }, 'attribution.offer', 'invalid_offer'],
    [{ cellId: 'x'.repeat(65) }, 'attribution.cellId', 'too_long'],
    [{ cellId: 'email@example.com' }, 'attribution.cellId', 'unsafe_identifier'],
    [{ utmSource: 'https://example.com' }, 'attribution.utmSource', 'unsafe_identifier'],
    [{ entryPath: '//evil.test/x' }, 'attribution.entryPath', 'unsafe_entry_path'],
    [{ entryPath: '/agent-security/../private' }, 'attribution.entryPath', 'unsafe_entry_path'],
  ])('rejects malformed attribution %#', (attribution, field, error) => {
    expect(validateContactIntake({ ...valid(), attribution }, now)).toMatchObject({ ok: false, errors: { [field]: error } });
  });

  it('rejects attribution on non-AOI sources', () => {
    expect(validateContactIntake({ ...valid(), source: 'nozaki.com', stage: undefined, attribution: { offer: 'general' } }, now)).toMatchObject({ ok: false, errors: { attribution: 'source_not_allowed' } });
  });

  it('forwards only allowlisted query keys and valid non-PII values', () => {
    const attribution = attributionFromQuery('?cell_id=cell-7&utm_source=google&utm_medium=cpc&utm_campaign=agent_security&utm_content=rsa_1&gclid=secret&email=person%40example.com&name=Private', { entryPath: '/agent-security/verification-support/', offer: 'sprint' });
    expect(attribution).toEqual({ cellId: 'cell-7', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'agent_security', utmContent: 'rsa_1', entryPath: '/agent-security/verification-support/', offer: 'sprint' });
    expect(JSON.stringify(attribution)).not.toMatch(/gclid|email|Private|secret/);
  });

  it('shares one bounded query bootstrap specification with the strict parser', () => {
    expect(attributionQuerySpecs).toEqual([
      { queryKey: 'cell_id', field: 'cellId', limit: 64 },
      { queryKey: 'utm_source', field: 'utmSource', limit: 100 },
      { queryKey: 'utm_medium', field: 'utmMedium', limit: 100 },
      { queryKey: 'utm_campaign', field: 'utmCampaign', limit: 100 },
      { queryKey: 'utm_content', field: 'utmContent', limit: 100 },
    ]);
  });

  it('parses only allowed intake query fields and drops unsafe values', () => {
    expect(intakeAttributionFromQuery('?cell_id=cell-1&utm_source=google&entry_path=%2Fagent-security%2Fverification-support%2F&offer=fail_review&gclid=secret&email=person%40example.com')).toEqual({
      cellId: 'cell-1', utmSource: 'google', entryPath: '/agent-security/verification-support/', offer: 'fail_review',
    });
    expect(intakeAttributionFromQuery('?cell_id=person%40example.com&entry_path=%2F%2Fevil.test&offer=enterprise')).toBeUndefined();
  });
});
