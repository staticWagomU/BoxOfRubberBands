import { defineConfig } from "astro/config";
import remarkBreaks from "remark-breaks";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";


// https://astro.build/config
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  // site: 'https://example.com',
  site: "https://wagomu.me",
  integrations: [mdx(), sitemap(), tailwind()],
  vite: {
    plugins: []
  },
  markdown: {
    remarkPlugins: [remarkBreaks],
    shikiConfig: {
      theme: "github-light"
    }
  }
});
