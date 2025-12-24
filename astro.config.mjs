import { defineConfig } from "astro/config";
import remarkBreaks from "remark-breaks";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import codeBlockPlugin from "./tools/remark-code-quote";
import rehypeHeadingSpan from "./tools/rehype-heading-span";
import rehypeLineNumbers from "./tools/rehype-line-numbers";
import rehypeCodeCopyButton from "./tools/rehype-code-copy-button";
import rehypeToc from "./tools/rehype-toc";
import remarkAside from "./tools/remark-aside";
import remarkGitDates from "./tools/remark-git-dates";

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
		resolve: {
			alias: {
				"@components": "/src/components",
				"@layouts": "/src/layouts",
				"@styles": "/src/styles",
			},
		},
	},
	markdown: {
		remarkRehype: {
			footnoteLabelTagName: "hr",
			footnoteLabel: " ",
		},
		remarkPlugins: [remarkAside, codeBlockPlugin, remarkBreaks, remarkGitDates],
		rehypePlugins: [
			rehypeLineNumbers,
			rehypeHeadingSpan,
			rehypeCodeCopyButton,
			[
				rehypeToc,
				{
					headings: ["h2", "h3"],
					className: "toc",
					title: "目次",
					titleClassName: "toc-title",
					listClassName: "toc-list",
					listItemClassName: "toc-item",
					linkClassName: "toc-link",
					collapsible: true,
					defaultOpen: false,
					splitView: true,
					pcClassName: "toc-pc",
				},
			],
		],
		shikiConfig: {
			defaultColor: false,
			themes: {
				light: "everforest-light",
				dark: "everforest-dark",
			},
			wrap: false,
		},
	},
	experimental: {
		liveContentCollections: true,
	},
});
