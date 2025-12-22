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

	describe("options", () => {
		it("should use custom buttonClassName", () => {
			const tree = createPreCodeTree("console.log('test');");
			const transform = rehypeCodeCopyButton({ buttonClassName: "custom-copy-btn" });

			transform(tree);

			const preElement = tree.children[0] as Element;
			const buttonChild = preElement.children.find(
				(child): child is Element =>
					child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild?.properties?.className).toContain("custom-copy-btn");
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

			const transform = rehypeCodeCopyButton();
			transform(tree);

			const preElement = tree.children[0] as Element;
			const buttonChild = preElement.children.find(
				(child): child is Element =>
					child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild).toBeUndefined();
		});

		it("should skip non-pre elements", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "div",
						properties: {},
						children: [
							{
								type: "element",
								tagName: "code",
								properties: {},
								children: [{ type: "text", value: "inline code" }],
							} as Element,
						],
					} as Element,
				],
			};

			const transform = rehypeCodeCopyButton();
			transform(tree);

			const divElement = tree.children[0] as Element;
			const buttonChild = divElement.children.find(
				(child): child is Element =>
					child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild).toBeUndefined();
		});

		it("should skip already wrapped code blocks", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "pre",
						properties: { className: ["code-block-with-copy"] },
						children: [
							{
								type: "element",
								tagName: "code",
								properties: {},
								children: [{ type: "text", value: "console.log('test');" }],
							} as Element,
						],
					} as Element,
				],
			};

			const transform = rehypeCodeCopyButton();
			transform(tree);

			const preElement = tree.children[0] as Element;
			// ボタンが追加されていないことを確認（子要素はcodeのみ）
			const buttonChildren = preElement.children.filter(
				(child): child is Element =>
					child.type === "element" && child.tagName === "button"
			);

			expect(buttonChildren.length).toBe(0);
		});
	});

	describe("class assignment", () => {
		it("should add code-block-with-copy class to pre element", () => {
			const tree = createPreCodeTree("console.log('hello');");
			const transform = rehypeCodeCopyButton();

			transform(tree);

			const preElement = tree.children[0] as Element;
			expect(preElement.properties?.className).toContain("code-block-with-copy");
		});
	});

	describe("data attributes", () => {
		it("should set correct data attributes on button", () => {
			const tree = createPreCodeTree("test");
			const transform = rehypeCodeCopyButton({
				buttonText: "コピー",
				buttonSuccessText: "コピー完了",
				successDuration: 3000,
			});

			transform(tree);

			const preElement = tree.children[0] as Element;
			const buttonChild = preElement.children.find(
				(child): child is Element =>
					child.type === "element" && child.tagName === "button"
			);

			expect(buttonChild?.properties?.["data-copy-text"]).toBe("コピー");
			expect(buttonChild?.properties?.["data-success-text"]).toBe("コピー完了");
			expect(buttonChild?.properties?.["data-success-duration"]).toBe(3000);
		});
	});
});
