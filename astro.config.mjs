import { defineConfig } from "astro/config";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import remarkBreaks from "remark-breaks";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config

// https://astro.build/config
export default defineConfig({
  // site: 'https://example.com',
  site: "https://wagomu.me",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
  markdown: {
    remarkPlugins: [remarkBreaks],
    shikiConfig: {
      theme: "github-light",
    },
  },
});
