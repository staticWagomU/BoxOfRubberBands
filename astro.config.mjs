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

// https://astro.build/config
export default defineConfig({
	site: "https://wagomu.me",
	build: {
		format: "file",
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
	// Inline (beasties) は全HTMLを毎回後処理するため incremental build の恩恵を受けられない。
	// ローカルの確認ビルドでは SKIP_INLINE=1 で丸ごと飛ばせる。本番ビルドでは必ず通すこと。
	integrations: [
		mdx(),
		...(process.env.SKIP_INLINE ? [] : [(await import("@playform/inline")).default()]),
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
	experimental: {
		incrementalBuild: true,
	},
});
