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

export type IntakeStage = (typeof intakeStages)[number];

export const notionStageLabels: Record<IntakeStage, string> = {
  deciding_where_to_start: 'Deciding where to start',
  trial_not_adopted: 'Trial not adopted',
  workflow_review: 'Workflow review',
  moving_to_operation: 'Moving to operation',
  aligning_team_decisions: 'Aligning team decisions',
  unclear_or_other: 'Unclear / Other',
};

export type ConsultationIntake = {
  schemaVersion: typeof INTAKE_SCHEMA_VERSION;
  idempotencyKey: string;
  stage: IntakeStage;
  situation: string;
  desiredTakeaway?: string;
  displayName?: string;
  email: string;
  organization?: string;
  consent: { privacyPolicy: true; noSensitiveData: true; version: typeof CONSENT_VERSION };
  antiSpam: { turnstileToken: string; website: string; formStartedAt: number };
  source?: 'consulting_page' | 'direct';
};

export type ValidationResult =
  | { ok: true; value: ConsultationIntake }
  | { ok: false; errors: Record<string, string> };

const rootKeys = new Set(['schemaVersion', 'idempotencyKey', 'stage', 'situation', 'desiredTakeaway', 'displayName', 'email', 'organization', 'consent', 'antiSpam', 'source']);
const consentKeys = new Set(['privacyPolicy', 'noSensitiveData', 'version']);
const antiSpamKeys = new Set(['turnstileToken', 'website', 'formStartedAt']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>, prefix: string, errors: Record<string, string>) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors[`${prefix}${key}`] = 'unknown_field';
}

export function validateConsultationIntake(input: unknown, now = Date.now()): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: { request: 'invalid_request' } };
  const raw = input as Record<string, unknown>;
  unknownKeys(raw, rootKeys, '', errors);

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== INTAKE_SCHEMA_VERSION) errors.schemaVersion = 'invalid_schema_version';
  const idempotencyKey = normalizeText(raw.idempotencyKey);
  if (!uuidPattern.test(idempotencyKey)) errors.idempotencyKey = 'invalid_idempotency_key';
  const stage = raw.stage;
  if (typeof stage !== 'string' || !intakeStages.includes(stage as IntakeStage)) errors.stage = 'invalid_stage';

  const situation = normalizeText(raw.situation);
  if (!situation) errors.situation = 'required'; else if (situation.length > 800) errors.situation = 'too_long';
  const desiredTakeaway = normalizeText(raw.desiredTakeaway);
  if (desiredTakeaway.length > 240) errors.desiredTakeaway = 'too_long';
  const displayName = normalizeText(raw.displayName);
  if (displayName.length > 100) errors.displayName = 'too_long';
  const email = normalizeText(raw.email);
  if (!email) errors.email = 'required'; else if (email.length < 3 || email.length > 254 || !emailPattern.test(email)) errors.email = 'invalid_email';
  const organization = normalizeText(raw.organization);
  if (organization.length > 200) errors.organization = 'too_long';

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
    turnstileToken = normalizeText(a.turnstileToken);
    website = normalizeText(a.website);
    formStartedAt = typeof a.formStartedAt === 'number' ? a.formStartedAt : 0;
    if (website) errors['antiSpam.website'] = 'spam_detected';
    if (!Number.isFinite(formStartedAt) || formStartedAt <= 0 || formStartedAt > now) errors['antiSpam.formStartedAt'] = 'invalid_started_at';
    else if (now - formStartedAt < 3_000) errors['antiSpam.formStartedAt'] = 'submitted_too_quickly';
    else if (now - formStartedAt > 24 * 60 * 60 * 1000) errors['antiSpam.formStartedAt'] = 'form_expired';
  }

  const source = raw.source;
  if (source !== undefined && source !== 'consulting_page' && source !== 'direct') errors.source = 'invalid_source';
  if (Object.keys(errors).length) return { ok: false, errors };

  return { ok: true, value: {
    schemaVersion: INTAKE_SCHEMA_VERSION,
    idempotencyKey,
    stage: stage as IntakeStage,
    situation,
    ...(desiredTakeaway ? { desiredTakeaway } : {}),
    ...(displayName ? { displayName } : {}),
    email,
    ...(organization ? { organization } : {}),
    consent: { privacyPolicy: true, noSensitiveData: true, version: CONSENT_VERSION },
    antiSpam: { turnstileToken, website: '', formStartedAt },
    ...(source ? { source: source as 'consulting_page' | 'direct' } : {}),
  } };
}

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
