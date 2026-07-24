import { validateRevisionEvents } from '../../../scripts/news-contract/rolling-feed.mjs';
import { loadNewsCatalog } from './load-news';
import { resolveNewsPublicationMode } from './publication-mode.mjs';
import type { NewsEditionEvent, NewsPublicationMode } from './types';

const eventModules = import.meta.glob('../../content/news/events/*.json', {
  eager: true,
  import: 'default',
});

const events = Object.keys(eventModules)
  .sort()
  .flatMap((path) => {
    const value = eventModules[path];
    if (!Array.isArray(value)) throw new Error(`AOIFUTURE News reviewed event file must contain an array: ${path}`);
    return value as NewsEditionEvent[];
  });

const completeEditions = loadNewsCatalog('review').editions;
const validation = validateRevisionEvents(events, completeEditions);
if (!validation.ok) {
  throw new Error(`AOIFUTURE News reviewed event validation failed: ${validation.errors.map((entry: { code: string; path: string }) => `${entry.code} ${entry.path}`).join(', ')}`);
}

const latestByEdition = new Map<string, NewsEditionEvent>();
for (const event of events) latestByEdition.set(event.edition_id, event);
for (const edition of completeEditions) {
  if (!latestByEdition.has(edition.edition_id)) {
    throw new Error(`AOIFUTURE News Edition lacks a reviewed public revision event: ${edition.edition_id}`);
  }
}

export function loadReviewedNewsEvents(
  mode: NewsPublicationMode = resolveNewsPublicationMode(process.env.VERCEL_ENV),
): NewsEditionEvent[] {
  const visibleIds = new Set(loadNewsCatalog(mode).editions.map((edition) => edition.edition_id));
  return events.filter((event) => visibleIds.has(event.edition_id));
}

export function getLatestReviewedEditionEvent(
  editionId: string,
  mode: NewsPublicationMode = resolveNewsPublicationMode(process.env.VERCEL_ENV),
): NewsEditionEvent {
  if (!loadNewsCatalog(mode).editions.some((edition) => edition.edition_id === editionId)) {
    throw new Error(`AOIFUTURE News Edition is hidden in ${mode} mode: ${editionId}`);
  }
  const event = latestByEdition.get(editionId);
  if (!event) throw new Error(`AOIFUTURE News Edition lacks a reviewed public revision event: ${editionId}`);
  return event;
}
