import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeBudoux from "./index.ts";

/**
 * シンプルなparagraph要素を持つHASTツリーを作成
 */
const createTree = (text: string): Root => ({
	type: "root",
	children: [
		{
			type: "element",
			tagName: "p",
			properties: {},
			children: [{ type: "text", value: text }],
		} as Element,
	],
});

/**
 * 指定されたタグでテキストをラップしたHASTツリーを作成
 */
const createTreeWithTag = (tagName: string, text: string): Root => ({
	type: "root",
	children: [
		{
			type: "element",
			tagName,
			properties: {},
			children: [{ type: "text", value: text }],
		} as Element,
	],
});

describe("rehype-budoux", () => {
	describe("basic functionality", () => {
		it("should insert ZWSP into Japanese text", () => {
			const tree = createTree("これはテストです");
			const transform = rehypeBudoux();

			transform(tree);

			const p = tree.children[0] as Element;
			const text = p.children[0] as Text;
			// BudouXがZWSP（U+200B）を挿入していることを確認
			expect(text.value).toContain("\u200B");
		});

		it("should not modify English text without natural break points", () => {
			const tree = createTree("Hello");
			const transform = rehypeBudoux();

			transform(tree);

			const p = tree.children[0] as Element;
			const text = p.children[0] as Text;
			// 短い英語テキストにはZWSPが挿入されない
			expect(text.value).toBe("Hello");
		});
	});

	describe("ignore tags", () => {
		it("should skip text inside code elements", () => {
			const tree = createTreeWithTag("code", "これはコード");
			const transform = rehypeBudoux();

			transform(tree);

			const code = tree.children[0] as Element;
			const text = code.children[0] as Text;
			expect(text.value).toBe("これはコード");
		});

		it("should skip text inside pre elements", () => {
			const tree = createTreeWithTag("pre", "これはプリフォーマット");
			const transform = rehypeBudoux();

			transform(tree);

			const pre = tree.children[0] as Element;
			const text = pre.children[0] as Text;
			expect(text.value).toBe("これはプリフォーマット");
		});

		it("should skip text inside nested code elements (pre > code)", () => {
			const tree: Root = {
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
								children: [{ type: "text", value: "ネストされたコード" }],
							} as Element,
						],
					} as Element,
				],
			};
			const transform = rehypeBudoux();

			transform(tree);

			const pre = tree.children[0] as Element;
			const code = pre.children[0] as Element;
			const text = code.children[0] as Text;
			expect(text.value).toBe("ネストされたコード");
		});

		it("should skip text inside script elements", () => {
			const tree = createTreeWithTag("script", "const x = 'テスト'");
			const transform = rehypeBudoux();

			transform(tree);

			const script = tree.children[0] as Element;
			const text = script.children[0] as Text;
			expect(text.value).toBe("const x = 'テスト'");
		});

		it("should skip text inside style elements", () => {
			const tree = createTreeWithTag("style", ".test { color: red; }");
			const transform = rehypeBudoux();

			transform(tree);

			const style = tree.children[0] as Element;
			const text = style.children[0] as Text;
			expect(text.value).toBe(".test { color: red; }");
		});
	});

	describe("options", () => {
		it("should skip text shorter than minLength", () => {
			const tree = createTree("あ");
			const transform = rehypeBudoux({ minLength: 2 });

			transform(tree);

			const p = tree.children[0] as Element;
			const text = p.children[0] as Text;
			expect(text.value).toBe("あ");
		});

		it("should process text equal to minLength", () => {
			const tree = createTree("日本語");
			const transform = rehypeBudoux({ minLength: 3 });

			transform(tree);

			const p = tree.children[0] as Element;
			const text = p.children[0] as Text;
			// 3文字以上なので処理される（ZWSPが入るかどうかはBudouX次第）
			// 少なくともエラーにならないことを確認
			expect(text.value).toBeDefined();
		});

		it("should use custom ignoreTags", () => {
			const tree = createTreeWithTag("span", "これはスパン");
			const transform = rehypeBudoux({ ignoreTags: ["span"] });

			transform(tree);

			const span = tree.children[0] as Element;
			const text = span.children[0] as Text;
			expect(text.value).toBe("これはスパン");
		});

		it("should merge custom ignoreTags with defaults when using addIgnoreTags", () => {
			// code（デフォルト）もspan（追加）も除外される
			const codeTree = createTreeWithTag("code", "これはコード");
			const spanTree = createTreeWithTag("span", "これはスパン");

			const transform = rehypeBudoux({ addIgnoreTags: ["span"] });

			transform(codeTree);
			transform(spanTree);

			const codeText = (codeTree.children[0] as Element).children[0] as Text;
			const spanText = (spanTree.children[0] as Element).children[0] as Text;

			expect(codeText.value).toBe("これはコード");
			expect(spanText.value).toBe("これはスパン");
		});

		it("should insert wbr elements when separator is wbr", () => {
			const tree = createTree("これはテストです");
			const transform = rehypeBudoux({ separator: "wbr" });

			transform(tree);

			const p = tree.children[0] as Element;

			// wbr要素が挿入されていることを確認
			const wbrElements = p.children.filter(
				(c): c is Element => c.type === "element" && c.tagName === "wbr"
			);
			expect(wbrElements.length).toBeGreaterThan(0);

			// テキストノードにZWSPが含まれていないことを確認
			const textNodes = p.children.filter((c): c is Text => c.type === "text");
			textNodes.forEach((textNode) => {
				expect(textNode.value).not.toContain("\u200B");
			});
		});
	});
});
