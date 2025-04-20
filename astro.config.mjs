import { defineConfig } from "astro/config";
import remarkBreaks from "remark-breaks";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import codeBlockPlugin from "./tools/remark-code-quote";
import rehypeHeadingSpan from "./tools/rehype-heading-span";
import rehypeLineNumbers from "./tools/rehype-line-numbers";
import remarkAside from "./tools/remark-aside";

import compressor from "astro-compressor";

// https://astro.build/config
export default defineConfig({
	site: "https://wagomu.me",
	build: {
		format: "file",
	},
	integrations: [
		mdx(),
		sitemap(),
		(await import("@playform/compress")).default({
			CSS: false,
			HTML: false,
			Image: false,
			JavaScript: true,
			SVG: true,
			Logger: 1,
		}),
		(await import("@playform/inline")).default(),
		compressor(),
	],
	trailingSlash: "never",
	vite: {
		plugins: [],
	},
	markdown: {
		remarkRehype: {
			footnoteLabelTagName: "hr",
			footnoteLabel: " ",
		},
		remarkPlugins: [remarkAside, codeBlockPlugin, remarkBreaks],
		rehypePlugins: [rehypeLineNumbers, rehypeHeadingSpan],
		shikiConfig: {
			defaultColor: false,
			themes: {
				light: "everforest-light",
				dark: "everforest-dark",
			},
			wrap: false,
		},
	},
});
