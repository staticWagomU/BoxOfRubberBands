import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

interface Options {
	buttonClassName?: string;
	buttonText?: string;
	buttonSuccessText?: string;
	successDuration?: number;
}

/**
 * Rehypeプラグイン: コードブロックにコピーボタンを追加
 */
export default function rehypeCodeCopyButton(options: Options = {}) {
	const {
		buttonClassName = "copy-button",
		buttonText = "Copy",
		buttonSuccessText = "Copied!",
		successDuration = 2000,
	} = options;

	return (tree: Root) => {
		visit(tree, "element", (node: Element) => {
			// pre > code のパターンを探す
			if (
				node.tagName !== "pre" ||
				node.children?.[0]?.type !== "element" ||
				(node.children[0] as Element).tagName !== "code"
			) {
				return;
			}

			// すでにラップされている場合はスキップ
			if (
				Array.isArray(node.properties?.className) &&
				node.properties.className.includes("code-block-with-copy")
			) {
				return;
			}

			// 親要素にクラスを追加
			node.properties = node.properties || {};
			node.properties.className = node.properties.className || [];
			if (!Array.isArray(node.properties.className)) {
				node.properties.className = [node.properties.className as string];
			}
			node.properties.className.push("code-block-with-copy");

			// コピーボタンを作成
			const copyButton: Element = {
				type: "element",
				tagName: "button",
				properties: {
					className: [buttonClassName],
					"aria-label": "コードをクリップボードにコピー",
					"data-copy-text": buttonText,
					"data-success-text": buttonSuccessText,
					"data-success-duration": successDuration,
				},
				children: [
					{
						type: "text",
						value: buttonText,
					},
				],
			};

			// ボタンをpre要素に追加
			node.children.push(copyButton);
		});
	};
}
