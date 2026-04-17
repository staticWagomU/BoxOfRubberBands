import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import codeBlockPlugin from "./tools/remark-code-quote";
import rehypeBudoux from "./tools/rehype-budoux";
import rehypeCodeCopyButton from "./tools/rehype-code-copy-button";
import rehypeExternalLinkFavicon from "./tools/rehype-external-link-favicon";
import rehypeHeadingSpan from "./tools/rehype-heading-span";
import rehypeLineNumbers from "./tools/rehype-line-numbers";
import rehypeToc from "./tools/rehype-toc";
import remarkAside from "./tools/remark-aside";
import remarkBreaks from "remark-breaks";
import remarkLinkCard from "./tools/remark-linkcard";
import gitDatesIntegration from "./tools/git-dates/integration";

// https://astro.build/config
export default defineConfig({
	site: "https://wagomu.me",
	build: {
		format: "file",
		concurrency: 10, // 並列ビルド数を増やしてI/O効率を向上
	},
	image: {
		service: {
			entrypoint: "astro/assets/services/sharp",
			config: {
				jpeg: { mozjpeg: true },
				webp: { effort: 6, alphaQuality: 80 },
				avif: { effort: 4, chromaSubsampling: "4:2:0" },
				png: { compressionLevel: 9 },
			},
		},
	},
	integrations: [
		gitDatesIntegration({
			excludeCommits: [
				"07cf7f5", // pubDateのdatetime一括変換 (機械的変更のため除外)
			],
		}),
		mdx(),
		(await import("@playform/inline")).default(),
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
		remarkPlugins: [remarkAside, codeBlockPlugin, remarkBreaks, remarkLinkCard],
		rehypePlugins: [
			rehypeBudoux,
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
			rehypeExternalLinkFavicon,
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
});
