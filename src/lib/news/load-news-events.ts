import { validateRevisionEvents } from '../../../scripts/news-contract/rolling-feed.mjs';
import { loadNewsCatalog } from './load-news';
import type { NewsEditionEvent } from './types';

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

const { editions } = loadNewsCatalog();
const validation = validateRevisionEvents(events, editions);
if (!validation.ok) {
  throw new Error(`AOIFUTURE News reviewed event validation failed: ${validation.errors.map((entry: { code: string; path: string }) => `${entry.code} ${entry.path}`).join(', ')}`);
}

const latestByEdition = new Map<string, NewsEditionEvent>();
for (const event of events) latestByEdition.set(event.edition_id, event);
for (const edition of editions) {
  if (!latestByEdition.has(edition.edition_id)) {
    throw new Error(`AOIFUTURE News Edition lacks a reviewed public revision event: ${edition.edition_id}`);
  }
}

export function loadReviewedNewsEvents(): NewsEditionEvent[] {
  return events;
}

export function getLatestReviewedEditionEvent(editionId: string): NewsEditionEvent {
  const event = latestByEdition.get(editionId);
  if (!event) throw new Error(`AOIFUTURE News Edition lacks a reviewed public revision event: ${editionId}`);
  return event;
}
