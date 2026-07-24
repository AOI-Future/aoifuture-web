import type { APIRoute } from 'astro';
import { loadNewsCatalog } from '../../lib/news/load-news';
import { renderRollingFeed } from '../../../scripts/news-contract/rolling-feed.mjs';

export const prerender = true;

const eventModules = import.meta.glob('../../content/news/events/*.json', {
  eager: true,
  import: 'default',
});
const events = Object.values(eventModules).flat();

export const GET: APIRoute = () => {
  const { editions } = loadNewsCatalog();
  const xml = renderRollingFeed(events, editions, { sample: true });
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
