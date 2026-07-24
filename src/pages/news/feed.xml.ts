import type { APIRoute } from 'astro';
import { loadNewsCatalog } from '../../lib/news/load-news';
import { loadReviewedNewsEvents } from '../../lib/news/load-news-events';
import { renderRollingFeed } from '../../../scripts/news-contract/rolling-feed.mjs';
import { resolveNewsPublicationMode } from '../../lib/news/publication-mode.mjs';

export const prerender = true;

export const GET: APIRoute = () => {
  const mode = resolveNewsPublicationMode(process.env.VERCEL_ENV);
  const { editions } = loadNewsCatalog(mode);
  const events = loadReviewedNewsEvents(mode);
  const xml = renderRollingFeed(events, editions, { mode });
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
