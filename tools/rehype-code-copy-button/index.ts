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
 * ボタンは.code-content要素に追加され、preの外に配置される
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
			// .code-content > pre > code のパターンを探す
			if (
				node.tagName !== "div" ||
				!Array.isArray(node.properties?.className) ||
				!node.properties.className.includes("code-content")
			) {
				return;
			}

			// すでにコピーボタンが追加されている場合はスキップ
			const hasButton = node.children.some(
				(child) =>
					child.type === "element" &&
					Array.isArray((child as Element).properties?.className) &&
					((child as Element).properties?.className as string[]).includes(buttonClassName)
			);
			if (hasButton) {
				return;
			}

			// pre要素を探す
			const preElement = node.children.find(
				(child) => child.type === "element" && (child as Element).tagName === "pre"
			) as Element | undefined;

			if (!preElement) {
				return;
			}

			// pre要素にクラスを追加（既存の動作との互換性のため）
			preElement.properties = preElement.properties || {};
			preElement.properties.className = preElement.properties.className || [];
			if (!Array.isArray(preElement.properties.className)) {
				preElement.properties.className = [preElement.properties.className as string];
			}
			if (!preElement.properties.className.includes("code-block-with-copy")) {
				preElement.properties.className.push("code-block-with-copy");
			}

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

			// ボタンを.code-content要素に追加（preの外）
			node.children.push(copyButton);
		});
	};
}
