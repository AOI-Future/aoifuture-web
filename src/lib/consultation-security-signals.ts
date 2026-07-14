import type { ContactIntake } from './consultation-intake';

export type IntakeSecurityFlag = 'Fast submit' | 'Many links' | 'Manual review';
export type IntakeSecurityAssessment = { flags: IntakeSecurityFlag[]; quarantine: boolean };

const urlPattern = /https?:\/\//giu;
const repeatedRunPattern = /(\S)\1{19,}/u;
const unicodeFormatPattern = /[\u061c\u200b\u200e-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u;

export function assessIntakeSecurity(input: ContactIntake, now: number): IntakeSecurityAssessment {
  const flags = new Set<IntakeSecurityFlag>();
  const text = [input.situation, input.desiredTakeaway || ''].join('\n');
  if (now - input.antiSpam.formStartedAt < 3_000) flags.add('Fast submit');
  if ((text.match(urlPattern) || []).length >= 4) flags.add('Many links');
  if (repeatedRunPattern.test(text) || unicodeFormatPattern.test(text)) flags.add('Manual review');
  const values = [...flags];
  return { flags: values, quarantine: values.length >= 2 || values.includes('Manual review') };
}
