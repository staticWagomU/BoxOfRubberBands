import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root, Element } from "hast";

interface Options {
	headings?: string[];
	className?: string;
	title?: string;
	titleClassName?: string;
	listClassName?: string;
	listItemClassName?: string;
	linkClassName?: string;
	collapsible?: boolean;
	defaultOpen?: boolean;
	pcClassName?: string;
}

interface HeadingInfo {
	tagName: string;
	text: string;
	id: string;
}

/**
 * Rehypeプラグイン: 目次（Table of Contents）を生成
 */
export default function rehypeToc(options: Options = {}) {
	const {
		headings = ["h2", "h3"],
		className = "toc",
		title = "目次",
		titleClassName = "toc-title",
		listClassName = "toc-list",
		listItemClassName = "toc-item",
		linkClassName = "toc-link",
		collapsible = true,
		defaultOpen = true,
		pcClassName = "toc-pc",
	} = options;

	return function transformer(tree: Root) {
		// 記事内の見出しを収集
		const headingNodes: HeadingInfo[] = [];
		visit(tree, "element", (node: Element) => {
			if (headings.includes(node.tagName)) {
				const text = toString(node);
				let id = (node.properties?.id as string) || createSlug(text);

				// 見出しにIDがなければ追加、または同名IDがある場合は重複を避ける
				if (!node.properties?.id) {
					let uniqueId = id;
					let counter = 1;
					while (headingNodes.some((h) => h.id === uniqueId)) {
						uniqueId = `${id}-${counter}`;
						counter++;
					}
					node.properties = node.properties || {};
					node.properties.id = uniqueId;
					id = uniqueId;
				}

				headingNodes.push({
					tagName: node.tagName,
					text,
					id,
				});
			}
		});

		// 見出しがなければTOCを作成しない
		if (headingNodes.length === 0) {
			return;
		}

		// TOCアイテムの生成関数
		function createTocItems(): Element[] {
			return headingNodes.map((heading) => {
				const link: Element = {
					type: "element",
					tagName: "a",
					properties: {
						class: linkClassName,
						href: `#${heading.id}`,
					},
					children: [{ type: "text", value: heading.text }],
				};

				return {
					type: "element",
					tagName: "li",
					properties: {
						class: `${listItemClassName} depth-${heading.tagName.substring(1)}`,
					},
					children: [link],
				};
			});
		}

		// TOCコンポーネントの生成関数
		function createTocComponent(additionalClassName = "", isPC = false): Element {
			const tocItems = createTocItems();

			const tocList: Element = {
				type: "element",
				tagName: "ul",
				properties: { class: listClassName },
				children: tocItems,
			};

			// 折りたたみ機能をつける場合はdetails/summaryを使用
			if (collapsible) {
				const tocSummary: Element = {
					type: "element",
					tagName: "summary",
					properties: { class: titleClassName },
					children: [{ type: "text", value: title }],
				};

				const tocDetails: Element = {
					type: "element",
					tagName: "details",
					properties: {
						class: `${className}-details`,
						open: isPC ? true : defaultOpen ? "open" : undefined,
					},
					children: [tocSummary, tocList],
				};

				return {
					type: "element",
					tagName: "div",
					properties: {
						class: additionalClassName ? `${className} ${additionalClassName}` : className,
					},
					children: [tocDetails],
				};
			} else {
				const tocTitle: Element = {
					type: "element",
					tagName: "h2",
					properties: { class: titleClassName },
					children: [{ type: "text", value: title }],
				};

				return {
					type: "element",
					tagName: "div",
					properties: {
						class: additionalClassName ? `${className} ${additionalClassName}` : className,
					},
					children: [tocTitle, tocList],
				};
			}
		}

		// モバイル用とPC用のTOCを作成
		const mobileTocContainer = createTocComponent("toc-mobile");
		const pcTocContainer = createTocComponent(pcClassName, true);

		// モバイル用TOCをコンテンツの最初に挿入
		if (tree.children && tree.children.length > 0) {
			tree.children.unshift(mobileTocContainer);
		}

		// PC用TOCをツリーの最後に追加
		if (tree.children && tree.children.length > 0) {
			tree.children.push(pcTocContainer);
		}
	};
}

/**
 * 簡易的なスラッグ生成関数
 */
function createSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\p{L}\p{N}]/gu, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}
