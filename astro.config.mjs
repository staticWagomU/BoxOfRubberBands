import { defineConfig } from "astro/config";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://wagomu.me",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
});
