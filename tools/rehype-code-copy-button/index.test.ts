import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeCodeCopyButton from "./index.ts";

/**
 * HASTツリーを直接操作してテストするヘルパー関数
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

describe("rehype-code-copy-button", () => {
	describe("basic functionality", () => {
		it("should add copy button to pre > code blocks", () => {
			const tree = createPreCodeTree("console.log('hello');");
			const transform = rehypeCodeCopyButton();

			transform(tree);

			const preElement = tree.children[0] as Element;

			// preに子要素としてbuttonが追加されているか
			const buttonChild = preElement.children.find(
				(child): child is Element =>
					child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild).toBeDefined();
			expect(buttonChild?.properties?.className).toContain("copy-button");
			expect(buttonChild?.properties?.["aria-label"]).toBe(
				"コードをクリップボードにコピー"
			);

			// ボタンのテキストがCopyであること
			const buttonText = buttonChild?.children[0] as Text;
			expect(buttonText?.value).toBe("Copy");
		});
	});
});
