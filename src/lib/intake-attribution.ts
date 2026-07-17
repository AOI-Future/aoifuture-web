export const intakeOffers = ['sprint', 'continuous', 'fail_review', 'general'] as const;
export type IntakeOffer = (typeof intakeOffers)[number];

export type IntakeAttribution = {
  cellId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  entryPath?: string;
  offer?: IntakeOffer;
};

export const attributionKeys = ['cellId', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'entryPath', 'offer'] as const;
export const attributionLimits: Record<(typeof attributionKeys)[number], number> = {
  cellId: 64,
  utmSource: 100,
  utmMedium: 100,
  utmCampaign: 100,
  utmContent: 100,
  entryPath: 160,
  offer: 16,
};

export const attributionIdentifierPatternSource = '^[\\p{L}\\p{N}][\\p{L}\\p{N}._~-]*$';
export const attributionEntryPathPatternSource = '^\\/[A-Za-z0-9._~\\/-]*$';
export const attributionControlPatternSource = '[\\u0000-\\u001F\\u007F-\\u009F]';
const identifierPattern = new RegExp(attributionIdentifierPatternSource, 'u');
const entryPathPattern = new RegExp(attributionEntryPathPatternSource);
const controlPattern = new RegExp(attributionControlPatternSource, 'g');

export function normalizeAttributionText(value: string): string {
  return value.normalize('NFC').replace(controlPattern, '').trim();
}

export function isSafeAttributionIdentifier(value: string): boolean {
  return identifierPattern.test(value);
}

export function isSafeEntryPath(value: string): boolean {
  if (!entryPathPattern.test(value) || value.startsWith('//') || value.includes('\\') || value.includes('?') || value.includes('#')) return false;
  return !value.split('/').some(segment => segment === '.' || segment === '..');
}

export const attributionQueryMap = {
  cell_id: 'cellId',
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
} as const;

export const attributionQuerySpecs = Object.entries(attributionQueryMap).map(([queryKey, field]) => ({
  queryKey,
  field,
  limit: attributionLimits[field as keyof typeof attributionLimits],
}));

/** Build attribution from an allowlisted query subset. Invalid values are omitted, never forwarded. */
export function attributionFromQuery(search: string, fixed: { entryPath: string; offer: IntakeOffer }): IntakeAttribution {
  const output: IntakeAttribution = { entryPath: fixed.entryPath, offer: fixed.offer };
  const params = new URLSearchParams(search);
  for (const [queryKey, field] of Object.entries(attributionQueryMap) as Array<[keyof typeof attributionQueryMap, (typeof attributionQueryMap)[keyof typeof attributionQueryMap]]>) {
    const raw = params.get(queryKey);
    if (raw === null) continue;
    const normalized = normalizeAttributionText(raw);
    if (normalized && normalized.length <= attributionLimits[field] && isSafeAttributionIdentifier(normalized)) output[field] = normalized;
  }
  return output;
}

/** Parse the intake page query without retaining unknown keys, click IDs, URLs, or PII. */
export function intakeAttributionFromQuery(search: string): IntakeAttribution | undefined {
  const params = new URLSearchParams(search);
  const output: IntakeAttribution = {};
  for (const [queryKey, field] of Object.entries(attributionQueryMap) as Array<[keyof typeof attributionQueryMap, (typeof attributionQueryMap)[keyof typeof attributionQueryMap]]>) {
    const raw = params.get(queryKey);
    if (raw === null) continue;
    const normalized = normalizeAttributionText(raw);
    if (normalized && normalized.length <= attributionLimits[field] && isSafeAttributionIdentifier(normalized)) output[field] = normalized;
  }
  const entryPath = normalizeAttributionText(params.get('entry_path') || '');
  if (entryPath && entryPath.length <= attributionLimits.entryPath && isSafeEntryPath(entryPath)) output.entryPath = entryPath;
  const offer = normalizeAttributionText(params.get('offer') || '');
  if (intakeOffers.includes(offer as IntakeOffer)) output.offer = offer as IntakeOffer;
  return Object.keys(output).length ? output : undefined;
}

/** Read the bounded, prototype-safe page-lifetime capture created before GA. */
export function pageLifetimeAttribution(): IntakeAttribution | undefined {
  const candidate = (window as Window & { __aoiSafeIntakeAttribution?: unknown }).__aoiSafeIntakeAttribution;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
  const input = candidate as Record<string, unknown>;
  const output: IntakeAttribution = {};
  for (const field of ['cellId', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent'] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, field) || typeof input[field] !== 'string') continue;
    const normalized = normalizeAttributionText(input[field]);
    if (normalized === input[field] && normalized.length <= attributionLimits[field] && isSafeAttributionIdentifier(normalized)) output[field] = normalized;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'entryPath') && typeof input.entryPath === 'string' && input.entryPath.length <= attributionLimits.entryPath && isSafeEntryPath(input.entryPath)) output.entryPath = input.entryPath;
  if (Object.prototype.hasOwnProperty.call(input, 'offer') && typeof input.offer === 'string' && intakeOffers.includes(input.offer as IntakeOffer)) output.offer = input.offer as IntakeOffer;
  return Object.keys(output).length ? output : undefined;
}
