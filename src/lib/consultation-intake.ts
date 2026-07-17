import { attributionKeys, attributionLimits, intakeOffers, isSafeAttributionIdentifier, isSafeEntryPath, normalizeAttributionText, type IntakeAttribution } from './intake-attribution';

export const INTAKE_SCHEMA_VERSION = '2026-07-14' as const;
export const CONSENT_VERSION = '2026-07-14' as const;

export const intakeStages = [
  'deciding_where_to_start',
  'trial_not_adopted',
  'workflow_review',
  'moving_to_operation',
  'aligning_team_decisions',
  'unclear_or_other',
] as const;

export const intakeSources = [
  'aoifuture.com/consulting/intake',
  'aoifuture.com/contact',
  'nozaki.com',
  'wfhradio.tokyo',
  'dispatch.aoifuture.com',
  'direct',
  'manual',
] as const;

export const inquiryTypes = [
  'Work Consultation',
  'Writing / Contribution',
  'Interview / Speaking',
  'Music / Creative',
  'Article Question / Correction',
  'AOI Future / NICTIA',
  'General / Other',
] as const;

export type IntakeStage = (typeof intakeStages)[number];
export type IntakeSource = (typeof intakeSources)[number];
export type InquiryType = (typeof inquiryTypes)[number];

export const notionStageLabels: Record<IntakeStage, string> = {
  deciding_where_to_start: 'Deciding where to start',
  trial_not_adopted: 'Trial not adopted',
  workflow_review: 'Workflow review',
  moving_to_operation: 'Moving to operation',
  aligning_team_decisions: 'Aligning team decisions',
  unclear_or_other: 'Unclear / Other',
};

export type ContactIntake = {
  schemaVersion: typeof INTAKE_SCHEMA_VERSION;
  idempotencyKey: string;
  source: IntakeSource;
  inquiryType: InquiryType;
  situation: string;
  desiredTakeaway?: string;
  displayName?: string;
  email: string;
  organization?: string;
  articleUrl?: string;
  stage?: IntakeStage;
  consent: { privacyPolicy: true; noSensitiveData: true; version: typeof CONSENT_VERSION };
  antiSpam: { turnstileToken: string; website: string; formStartedAt: number };
  attribution?: IntakeAttribution;
};

// Kept as an exported alias for existing imports while the intake becomes shared.
export type ConsultationIntake = ContactIntake;

export type ValidationResult =
  | { ok: true; value: ContactIntake }
  | { ok: false; errors: Record<string, string> };

const rootKeys = new Set(['schemaVersion', 'idempotencyKey', 'source', 'inquiryType', 'situation', 'desiredTakeaway', 'displayName', 'email', 'organization', 'articleUrl', 'stage', 'consent', 'antiSpam', 'attribution']);
const consentKeys = new Set(['privacyPolicy', 'noSensitiveData', 'version']);
const antiSpamKeys = new Set(['turnstileToken', 'website', 'formStartedAt']);
const attributionKeySet = new Set<string>(attributionKeys);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>, prefix: string, errors: Record<string, string>) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors[`${prefix}${key}`] = 'unknown_field';
}

function optionalText(raw: Record<string, unknown>, field: string, errors: Record<string, string>): string {
  const value = raw[field];
  if (value === undefined) return '';
  if (typeof value !== 'string') { errors[field] = 'invalid_type'; return ''; }
  return normalizeText(value);
}

export function validateContactIntake(input: unknown, now = Date.now()): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: { request: 'invalid_request' } };
  const raw = input as Record<string, unknown>;
  unknownKeys(raw, rootKeys, '', errors);

  if (raw.schemaVersion !== INTAKE_SCHEMA_VERSION) errors.schemaVersion = 'invalid_schema_version';
  const idempotencyKey = normalizeText(raw.idempotencyKey);
  if (!uuidPattern.test(idempotencyKey)) errors.idempotencyKey = 'invalid_idempotency_key';

  const source = normalizeText(raw.source);
  if (!intakeSources.includes(source as IntakeSource)) errors.source = 'invalid_source';
  const inquiryType = normalizeText(raw.inquiryType);
  if (!inquiryTypes.includes(inquiryType as InquiryType)) errors.inquiryType = 'invalid_inquiry_type';

  const stage = optionalText(raw, 'stage', errors);
  const stageRequired = source === 'aoifuture.com/consulting/intake' && inquiryType === 'Work Consultation';
  if (stageRequired && !stage && !errors.stage) errors.stage = 'required';
  else if (stage && !intakeStages.includes(stage as IntakeStage)) errors.stage = 'invalid_stage';

  const situation = normalizeText(raw.situation);
  if (!situation) errors.situation = 'required'; else if (situation.length > 800) errors.situation = 'too_long';
  const desiredTakeaway = optionalText(raw, 'desiredTakeaway', errors);
  if (desiredTakeaway.length > 240) errors.desiredTakeaway = 'too_long';
  const displayName = optionalText(raw, 'displayName', errors);
  if (displayName.length > 100) errors.displayName = 'too_long';
  const email = normalizeText(raw.email);
  if (!email) errors.email = 'required'; else if (email.length < 3 || email.length > 254 || !emailPattern.test(email)) errors.email = 'invalid_email';
  const organization = optionalText(raw, 'organization', errors);
  if (organization.length > 200) errors.organization = 'too_long';
  const articleUrl = optionalText(raw, 'articleUrl', errors);
  if (articleUrl.length > 500) errors.articleUrl = 'too_long';
  else if (articleUrl) {
    try { const url = new URL(articleUrl); if (url.protocol !== 'https:' && url.protocol !== 'http:') errors.articleUrl = 'invalid_url'; }
    catch { errors.articleUrl = 'invalid_url'; }
  }

  let attribution: IntakeAttribution | undefined;
  if (raw.attribution !== undefined) {
    if (!raw.attribution || typeof raw.attribution !== 'object' || Array.isArray(raw.attribution)) errors.attribution = 'invalid_type';
    else {
      const a = raw.attribution as Record<string, unknown>;
      unknownKeys(a, attributionKeySet, 'attribution.', errors);
      const normalized: Record<string, string> = {};
      for (const key of attributionKeys) {
        const value = a[key];
        if (value === undefined) continue;
        if (typeof value !== 'string') { errors[`attribution.${key}`] = 'invalid_type'; continue; }
        const text = normalizeAttributionText(value);
        if (!text) { errors[`attribution.${key}`] = 'invalid_value'; continue; }
        if (text.length > attributionLimits[key]) { errors[`attribution.${key}`] = 'too_long'; continue; }
        if (key === 'entryPath') {
          if (!isSafeEntryPath(text)) errors[`attribution.${key}`] = 'unsafe_entry_path';
        } else if (key === 'offer') {
          if (!intakeOffers.includes(text as (typeof intakeOffers)[number])) errors[`attribution.${key}`] = 'invalid_offer';
        } else if (!isSafeAttributionIdentifier(text)) errors[`attribution.${key}`] = 'unsafe_identifier';
        normalized[key] = text;
      }
      if (!source.startsWith('aoifuture.com/')) errors.attribution = 'source_not_allowed';
      attribution = normalized as IntakeAttribution;
    }
  }

  const consent = raw.consent;
  if (!consent || typeof consent !== 'object' || Array.isArray(consent)) errors.consent = 'required';
  else {
    const c = consent as Record<string, unknown>;
    unknownKeys(c, consentKeys, 'consent.', errors);
    if (c.privacyPolicy !== true) errors['consent.privacyPolicy'] = 'required';
    if (c.noSensitiveData !== true) errors['consent.noSensitiveData'] = 'required';
    if (c.version !== CONSENT_VERSION) errors['consent.version'] = 'invalid_consent_version';
  }

  const antiSpam = raw.antiSpam;
  let turnstileToken = '', website = '', formStartedAt = 0;
  if (!antiSpam || typeof antiSpam !== 'object' || Array.isArray(antiSpam)) errors.antiSpam = 'required';
  else {
    const a = antiSpam as Record<string, unknown>;
    unknownKeys(a, antiSpamKeys, 'antiSpam.', errors);
    if (typeof a.turnstileToken !== 'string') errors['antiSpam.turnstileToken'] = 'invalid_type';
    else turnstileToken = normalizeText(a.turnstileToken);
    if (typeof a.website !== 'string') errors['antiSpam.website'] = 'invalid_type';
    else website = normalizeText(a.website);
    formStartedAt = typeof a.formStartedAt === 'number' ? a.formStartedAt : 0;
    if (website) errors['antiSpam.website'] = 'spam_detected';
    if (!Number.isFinite(formStartedAt) || formStartedAt <= 0 || formStartedAt > now) errors['antiSpam.formStartedAt'] = 'invalid_started_at';
    else if (now - formStartedAt > 24 * 60 * 60 * 1000) errors['antiSpam.formStartedAt'] = 'form_expired';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: {
    schemaVersion: INTAKE_SCHEMA_VERSION,
    idempotencyKey,
    source: source as IntakeSource,
    inquiryType: inquiryType as InquiryType,
    situation,
    ...(desiredTakeaway ? { desiredTakeaway } : {}),
    ...(displayName ? { displayName } : {}),
    email,
    ...(organization ? { organization } : {}),
    ...(articleUrl ? { articleUrl } : {}),
    ...(stage ? { stage: stage as IntakeStage } : {}),
    consent: { privacyPolicy: true, noSensitiveData: true, version: CONSENT_VERSION },
    antiSpam: { turnstileToken, website: '', formStartedAt },
    ...(attribution ? { attribution } : {}),
  } };
}

export const validateConsultationIntake = validateContactIntake;

export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}
