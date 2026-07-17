import { attributionFromQuery, type IntakeAttribution } from '../lib/intake-attribution';
import { emitAnalyticsBestEffort } from '../lib/analytics';

const ENTRY_PATH = '/agent-security/verification-support/';
const allowedEventFields = (attribution: IntakeAttribution, ctaLocation?: string) => ({
  offer: attribution.offer || 'general',
  ...(attribution.cellId ? { cell_id: attribution.cellId } : {}),
  entry_path: ENTRY_PATH,
  ...(ctaLocation ? { cta_location: ctaLocation } : {}),
});
const links = [...document.querySelectorAll<HTMLAnchorElement>('a[data-intake-offer][data-as-location]')];
let viewSent = false;
const viewAttribution = attributionFromQuery(window.location.search, { entryPath: ENTRY_PATH, offer: 'general' });
const emitView = () => {
  if (viewSent) return;
  viewSent = emitAnalyticsBestEffort('verification_support_view', () => allowedEventFields(viewAttribution));
};

for (const link of links) {
  const offer = link.dataset.intakeOffer as 'sprint' | 'continuous' | 'fail_review' | 'general';
  const attribution = attributionFromQuery(window.location.search, { entryPath: ENTRY_PATH, offer });
  const target = new URL('/consulting/intake', window.location.origin);
  const queryFields: Array<[keyof IntakeAttribution, string]> = [
    ['cellId', 'cell_id'], ['utmSource', 'utm_source'], ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'], ['utmContent', 'utm_content'], ['entryPath', 'entry_path'], ['offer', 'offer'],
  ];
  for (const [field, queryKey] of queryFields) if (attribution[field]) target.searchParams.set(queryKey, attribution[field] as string);
  link.href = `${target.pathname}${target.search}`;
  link.addEventListener('click', () => emitAnalyticsBestEffort('verification_support_intake_click', () => allowedEventFields(attribution, link.dataset.asLocation)));
}

emitView();
window.addEventListener('aoi:analytics-consent', emitView);
