// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://aoifuture.com',
  integrations: [react(), sitemap({
    filter: (page) => !page.includes('/consulting'),
  })],

  vite: {
    plugins: [tailwindcss()]
  },

  devToolbar: { enabled: false },
  output: 'server',
  adapter: vercel()
});