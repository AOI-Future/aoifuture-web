import type { APIRoute } from 'astro';
import { loadNewsCatalog } from '../../lib/news/load-news';
import { loadReviewedNewsEvents } from '../../lib/news/load-news-events';
import { renderRollingFeed } from '../../../scripts/news-contract/rolling-feed.mjs';

export const prerender = true;

export const GET: APIRoute = () => {
  const { editions } = loadNewsCatalog();
  const events = loadReviewedNewsEvents();
  const xml = renderRollingFeed(events, editions, { sample: true });
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
