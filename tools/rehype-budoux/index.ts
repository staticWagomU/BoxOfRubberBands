import { visit, SKIP } from "unist-util-visit";
import { loadDefaultJapaneseParser } from "budoux";
import type { Root, Text, Element, Parents, RootContent } from "hast";

const DEFAULT_IGNORE_TAGS = ["code", "pre", "script", "style", "kbd", "samp"];

export interface RehypeBudouxOptions {
	/** 最小文字数（これより短いテキストはスキップ） */
	minLength?: number;
	/** 除外するタグ（デフォルトを上書き） */
	ignoreTags?: string[];
	/** デフォルトに追加する除外タグ */
	addIgnoreTags?: string[];
	/** セパレータの種類（デフォルト: zwsp） */
	separator?: "zwsp" | "wbr";
}

/**
 * wbr要素を作成
 */
function createWbrElement(): Element {
	return {
		type: "element",
		tagName: "wbr",
		properties: {},
		children: [],
	};
}

/**
 * rehype-budoux: 日本語テキストにZWSPを挿入して自然な改行位置を提供
 */
export default function rehypeBudoux(options: RehypeBudouxOptions = {}) {
	const {
		minLength = 1,
		ignoreTags: customIgnoreTags,
		addIgnoreTags = [],
		separator = "zwsp",
	} = options;

	const parser = loadDefaultJapaneseParser();

	// ignoreTagsが指定されていればそれを使用、そうでなければデフォルト + 追加タグ
	const ignoreTags = customIgnoreTags ?? [...DEFAULT_IGNORE_TAGS, ...addIgnoreTags];

	return (tree: Root) => {
		visit(tree, "text", (node: Text, index, parent: Parents | undefined) => {
			// 親が除外タグの場合はスキップ
			if (
				parent &&
				parent.type === "element" &&
				ignoreTags.includes((parent as Element).tagName)
			) {
				return SKIP;
			}

			// minLengthより短いテキストはスキップ
			if (node.value.length < minLength) {
				return;
			}

			const chunks = parser.parse(node.value);

			if (separator === "zwsp") {
				node.value = chunks.join("\u200B");
			} else if (separator === "wbr" && parent && typeof index === "number") {
				// wbrモード: テキストノードを分割してwbr要素を挿入
				const newChildren: RootContent[] = [];

				chunks.forEach((chunk, i) => {
					newChildren.push({ type: "text", value: chunk });
					if (i < chunks.length - 1) {
						newChildren.push(createWbrElement());
					}
				});

				// 親ノードのchildrenを置換
				parent.children.splice(index, 1, ...newChildren);

				// 挿入したノード数分だけスキップ
				return index + newChildren.length;
			}
		});
	};
}
