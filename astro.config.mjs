import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config

// https://astro.build/config
export default defineConfig({
  // site: 'https://example.com',
  site: 'https://staticWagomU.github.io/',
  integrations: [mdx(), sitemap()]
});