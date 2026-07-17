import { createHash } from 'node:crypto';
import type { ContactIntake } from './consultation-intake';

/** Hash only normalized business semantics; anti-abuse and timing fields never participate. */
export function contactPayloadFingerprint(input: ContactIntake): string {
  const semanticPayload = {
    source: input.source,
    inquiryType: input.inquiryType,
    stage: input.stage || '',
    situation: input.situation,
    desiredTakeaway: input.desiredTakeaway || '',
    displayName: input.displayName || '',
    email: input.email.toLowerCase(),
    organization: input.organization || '',
    articleUrl: input.articleUrl || '',
    consentVersion: input.consent.version,
    attribution: input.attribution || {},
  };
  return createHash('sha256').update(JSON.stringify(semanticPayload), 'utf8').digest('hex');
}
