import { visit } from "unist-util-visit";
import * as budoux from "budoux";
import type { Root, Text as MdastText, Html } from "mdast";

/**
 * Remarkプラグイン: BudouXを使用して日本語の折り返し位置を最適化
 * テキストノードをHTMLノードに変換し、word-break用のタグを挿入
 */
export default function remarkBudoux() {
	const parser = budoux.loadDefaultJapaneseParser();

	return (tree: Root) => {
		visit(tree, "text", (node: MdastText, index: number | undefined, parent) => {
			if (!parent || typeof index !== "number") return;

			if (node.value.trim()) {
				const htmlNode: Html = {
					type: "html",
					value: parser.translateHTMLString(node.value),
				};
				parent.children[index] = htmlNode;
			}
		});
	};
}
