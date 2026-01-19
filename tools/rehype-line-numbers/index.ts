import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root, Element, Parent } from "hast";

interface Options {
	startFrom1?: boolean;
	className?: string;
	wrapperClassName?: string;
}

/**
 * Rehypeプラグイン: コードブロックに行番号を追加
 */
export default function rehypeLineNumbers(options: Options = {}) {
	const {
		startFrom1 = true,
		className = "line-number",
		wrapperClassName = "code-block-wrapper",
	} = options;

	return (tree: Root) => {
		visit(
			tree,
			"element",
			(node: Element, index: number | undefined, parent: Parent | undefined) => {
				// pre > code のパターンを探す（バグ修正: 元のコードは条件式が間違っていた）
				if (
					node.tagName !== "pre" ||
					node.children?.[0]?.type !== "element" ||
					(node.children[0] as Element).tagName !== "code"
				) {
					return;
				}

				const codeNode = node.children[0] as Element;

				// hast-util-to-stringを使用して安全にテキストを抽出
				const code = toString(codeNode);
				// 空の行を保持しながら分割
				const lines = code.split(/\r?\n/);
				const startNumber = startFrom1 ? 1 : 0;

				// 行番号要素の作成
				const lineNumbers: Element = {
					type: "element",
					tagName: "div",
					properties: {
						className: [className],
					},
					children: lines.map((_, i) => ({
						type: "element" as const,
						tagName: "span",
						properties: {
							className: [`${className}-item`],
							"data-line-number": startNumber + i,
						},
						children: [
							{
								type: "text" as const,
								value: String(startNumber + i),
							},
						],
					})),
				};

				// コードコンテンツをdiv要素でラップ
				const codeWrapper: Element = {
					type: "element",
					tagName: "div",
					properties: {
						className: ["code-content"],
					},
					children: [node],
				};

				// メインラッパーの作成
				const wrapper: Element = {
					type: "element",
					tagName: "div",
					properties: {
						className: [wrapperClassName],
					},
					children: [lineNumbers, codeWrapper],
				};

				// 親ノードの子要素を更新
				if (parent && typeof index === "number") {
					parent.children[index] = wrapper;
				}
			}
		);
	};
}
