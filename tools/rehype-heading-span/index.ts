import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/**
 * Rehypeプラグイン: 見出し要素の内容をspan要素でラップ
 * スタイリング目的で見出しの内容をspanで囲む
 */
export default function rehypeHeadingSpan() {
	return function transformer(tree: Root) {
		visit(tree, "element", (node: Element) => {
			if (HEADING_TAGS.includes(node.tagName as (typeof HEADING_TAGS)[number])) {
				node.children = [
					{
						type: "element",
						tagName: "span",
						properties: {},
						children: node.children,
					},
				];
			}
		});
	};
}
