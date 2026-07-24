// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveNewsPublicationMode } from './src/lib/news/publication-mode.mjs';

const newsMode = resolveNewsPublicationMode(process.env.VERCEL_ENV);
const reviewOnlyNewsPaths = new Set();
if (newsMode === 'production') {
  for (const name of readdirSync(resolve('src/content/news/editions')).filter((entry) => entry.endsWith('.json'))) {
    const edition = JSON.parse(readFileSync(resolve('src/content/news/editions', name), 'utf8'));
    if (edition.publication_status !== 'public') reviewOnlyNewsPaths.add(`/news/${edition.edition_id}/`);
  }
  for (const name of readdirSync(resolve('src/content/news/contexts')).filter((entry) => entry.endsWith('.json'))) {
    const context = JSON.parse(readFileSync(resolve('src/content/news/contexts', name), 'utf8'));
    if (context.publication_status !== 'public') reviewOnlyNewsPaths.add(`/news/context/${context.slug}/`);
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://aoifuture.com',
  integrations: [react(), sitemap({
    filter: (page) => !page.includes('/consulting')
      && !reviewOnlyNewsPaths.has(new URL(page).pathname),
  })],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { include: ['react-dom/client'] }
  },

  devToolbar: { enabled: false },
  output: 'server',
  adapter: vercel()
});