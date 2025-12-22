import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeLineNumbers from "./index.ts";

/**
 * pre > code を含むHASTツリーを作成
 */
const createPreCodeTree = (codeContent: string): Root => ({
	type: "root",
	children: [
		{
			type: "element",
			tagName: "pre",
			properties: {},
			children: [
				{
					type: "element",
					tagName: "code",
					properties: {},
					children: [{ type: "text", value: codeContent }],
				},
			],
		} as Element,
	],
});

describe("rehype-line-numbers", () => {
	describe("basic functionality", () => {
		it("should wrap pre element with line numbers container", () => {
			const tree = createPreCodeTree("line1\nline2\nline3");
			const transform = rehypeLineNumbers();

			transform(tree);

			// ルートの最初の子がラッパーdivになっているか
			const wrapper = tree.children[0] as Element;
			expect(wrapper.tagName).toBe("div");
			expect(wrapper.properties?.className).toContain("code-block-wrapper");

			// ラッパーの子要素として行番号divとコードコンテンツdivがあるか
			expect(wrapper.children.length).toBe(2);

			const lineNumbersDiv = wrapper.children[0] as Element;
			expect(lineNumbersDiv.tagName).toBe("div");
			expect(lineNumbersDiv.properties?.className).toContain("line-number");

			// 行番号が3つあるか（3行のコード）
			expect(lineNumbersDiv.children.length).toBe(3);

			// 最初の行番号が1であるか
			const firstLineNumber = lineNumbersDiv.children[0] as Element;
			const firstLineText = firstLineNumber.children[0] as Text;
			expect(firstLineText.value).toBe("1");
		});
	});

	describe("options", () => {
		it("should use custom className", () => {
			const tree = createPreCodeTree("test");
			const transform = rehypeLineNumbers({ className: "custom-line-num" });

			transform(tree);

			const wrapper = tree.children[0] as Element;
			const lineNumbersDiv = wrapper.children[0] as Element;
			expect(lineNumbersDiv.properties?.className).toContain("custom-line-num");
		});

		it("should start from 0 when startFrom1 is false", () => {
			const tree = createPreCodeTree("line1\nline2");
			const transform = rehypeLineNumbers({ startFrom1: false });

			transform(tree);

			const wrapper = tree.children[0] as Element;
			const lineNumbersDiv = wrapper.children[0] as Element;
			const firstLineNumber = lineNumbersDiv.children[0] as Element;
			const firstLineText = firstLineNumber.children[0] as Text;
			expect(firstLineText.value).toBe("0");
		});

		it("should use custom wrapperClassName", () => {
			const tree = createPreCodeTree("test");
			const transform = rehypeLineNumbers({ wrapperClassName: "my-wrapper" });

			transform(tree);

			const wrapper = tree.children[0] as Element;
			expect(wrapper.properties?.className).toContain("my-wrapper");
		});
	});

	describe("skip cases", () => {
		it("should skip pre without code child", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "pre",
						properties: {},
						children: [{ type: "text", value: "plain text" }],
					} as Element,
				],
			};

			const transform = rehypeLineNumbers();
			transform(tree);

			// preがそのまま残っているか（ラッパーに変換されていない）
			const preElement = tree.children[0] as Element;
			expect(preElement.tagName).toBe("pre");
		});

		it("should skip non-pre elements", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "div",
						properties: {},
						children: [{ type: "text", value: "text" }],
					} as Element,
				],
			};

			const transform = rehypeLineNumbers();
			transform(tree);

			const divElement = tree.children[0] as Element;
			expect(divElement.tagName).toBe("div");
		});
	});
});
