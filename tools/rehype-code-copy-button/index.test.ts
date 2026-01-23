import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeCodeCopyButton from "./index.ts";

/**
 * HASTツリーを直接操作してテストするヘルパー関数
 * rehype-line-numbersが作成する構造を模倣: .code-content > pre > code
 */
const createCodeContentTree = (codeContent: string): Root => ({
	type: "root",
	children: [
		{
			type: "element",
			tagName: "div",
			properties: { className: ["code-content"] },
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
		} as Element,
	],
});

/**
 * 旧形式のpre > codeツリー（.code-contentなし）
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
		it("should add copy button to .code-content element", () => {
			const tree = createCodeContentTree("console.log('hello');");
			const transform = rehypeCodeCopyButton();

			transform(tree);

			const codeContent = tree.children[0] as Element;

			// .code-contentに子要素としてbuttonが追加されているか
			const buttonChild = codeContent.children.find(
				(child): child is Element => child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild).toBeDefined();
			expect(buttonChild?.properties?.className).toContain("copy-button");
			expect(buttonChild?.properties?.["aria-label"]).toBe("コードをクリップボードにコピー");

			// ボタンのテキストがCopyであること
			const buttonText = buttonChild?.children[0] as Text;
			expect(buttonText?.value).toBe("Copy");
		});

		it("should add code-block-with-copy class to pre element", () => {
			const tree = createCodeContentTree("console.log('hello');");
			const transform = rehypeCodeCopyButton();

			transform(tree);

			const codeContent = tree.children[0] as Element;
			const preElement = codeContent.children.find(
				(child): child is Element => child.type === "element" && child.tagName === "pre"
			);

			expect(preElement?.properties?.className).toContain("code-block-with-copy");
		});
	});

	describe("options", () => {
		it("should use custom buttonClassName", () => {
			const tree = createCodeContentTree("console.log('test');");
			const transform = rehypeCodeCopyButton({ buttonClassName: "custom-copy-btn" });

			transform(tree);

			const codeContent = tree.children[0] as Element;
			const buttonChild = codeContent.children.find(
				(child): child is Element => child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild?.properties?.className).toContain("custom-copy-btn");
		});
	});

	describe("skip cases", () => {
		it("should skip pre without .code-content wrapper", () => {
			const tree = createPreCodeTree("console.log('hello');");
			const transform = rehypeCodeCopyButton();

			transform(tree);

			const preElement = tree.children[0] as Element;
			const buttonChild = preElement.children.find(
				(child): child is Element => child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild).toBeUndefined();
		});

		it("should skip .code-content without pre child", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "div",
						properties: { className: ["code-content"] },
						children: [{ type: "text", value: "plain text" }],
					} as Element,
				],
			};

			const transform = rehypeCodeCopyButton();
			transform(tree);

			const codeContent = tree.children[0] as Element;
			const buttonChild = codeContent.children.find(
				(child): child is Element => child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild).toBeUndefined();
		});

		it("should skip already processed .code-content", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "div",
						properties: { className: ["code-content"] },
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
										children: [{ type: "text", value: "console.log('test');" }],
									} as Element,
								],
							} as Element,
							{
								type: "element",
								tagName: "button",
								properties: { className: ["copy-button"] },
								children: [{ type: "text", value: "Copy" }],
							} as Element,
						],
					} as Element,
				],
			};

			const transform = rehypeCodeCopyButton();
			transform(tree);

			const codeContent = tree.children[0] as Element;
			// ボタンが1つだけであることを確認（新しいボタンが追加されていない）
			const buttonChildren = codeContent.children.filter(
				(child): child is Element => child.type === "element" && child.tagName === "button"
			);

			expect(buttonChildren.length).toBe(1);
		});
	});

	describe("data attributes", () => {
		it("should set correct data attributes on button", () => {
			const tree = createCodeContentTree("test");
			const transform = rehypeCodeCopyButton({
				buttonText: "コピー",
				buttonSuccessText: "コピー完了",
				successDuration: 3000,
			});

			transform(tree);

			const codeContent = tree.children[0] as Element;
			const buttonChild = codeContent.children.find(
				(child): child is Element => child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild?.properties?.["data-copy-text"]).toBe("コピー");
			expect(buttonChild?.properties?.["data-success-text"]).toBe("コピー完了");
			expect(buttonChild?.properties?.["data-success-duration"]).toBe(3000);
		});
	});
});
