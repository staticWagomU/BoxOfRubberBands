import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeToc from "./index.ts";

const createTreeWithHeadings = (): Root => ({
	type: "root",
	children: [
		{
			type: "element",
			tagName: "h2",
			properties: {},
			children: [{ type: "text", value: "Introduction" }],
		} as Element,
		{
			type: "element",
			tagName: "p",
			properties: {},
			children: [{ type: "text", value: "Content" }],
		} as Element,
		{
			type: "element",
			tagName: "h3",
			properties: {},
			children: [{ type: "text", value: "Details" }],
		} as Element,
	],
});

describe("rehype-toc", () => {
	describe("basic functionality", () => {
		it("should add mobile TOC at the beginning", () => {
			const tree = createTreeWithHeadings();
			const transform = rehypeToc();

			transform(tree);

			const firstChild = tree.children[0] as Element;
			expect(firstChild.tagName).toBe("div");
			expect(firstChild.properties?.class).toContain("toc");
			expect(firstChild.properties?.class).toContain("toc-mobile");
		});

		it("should add PC TOC at the end", () => {
			const tree = createTreeWithHeadings();
			const transform = rehypeToc();

			transform(tree);

			const lastChild = tree.children[tree.children.length - 1] as Element;
			expect(lastChild.tagName).toBe("div");
			expect(lastChild.properties?.class).toContain("toc-pc");
		});

		it("should generate TOC links for h2 and h3 by default", () => {
			const tree = createTreeWithHeadings();
			const transform = rehypeToc();

			transform(tree);

			const mobileToc = tree.children[0] as Element;
			const details = mobileToc.children[0] as Element;
			const ul = details.children[1] as Element;

			// 2つのTOCアイテム（h2とh3）
			expect(ul.children.length).toBe(2);
		});

		it("should assign IDs to headings without IDs", () => {
			const tree = createTreeWithHeadings();
			const transform = rehypeToc();

			transform(tree);

			// h2要素を探す（TOCが先頭に追加されているので位置が変わる）
			const h2 = tree.children[1] as Element;
			expect(h2.properties?.id).toBeDefined();
		});
	});

	describe("options", () => {
		it("should use custom title", () => {
			const tree = createTreeWithHeadings();
			const transform = rehypeToc({ title: "Table of Contents" });

			transform(tree);

			const mobileToc = tree.children[0] as Element;
			const details = mobileToc.children[0] as Element;
			const summary = details.children[0] as Element;
			const text = summary.children[0] as Text;

			expect(text.value).toBe("Table of Contents");
		});

		it("should not create TOC when no headings match", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "No headings here" }],
					} as Element,
				],
			};

			const originalLength = tree.children.length;
			const transform = rehypeToc();

			transform(tree);

			expect(tree.children.length).toBe(originalLength);
		});
	});

	describe("duplicate heading handling", () => {
		it("should generate unique IDs for duplicate headings", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "h2",
						properties: {},
						children: [{ type: "text", value: "Section" }],
					} as Element,
					{
						type: "element",
						tagName: "h2",
						properties: {},
						children: [{ type: "text", value: "Section" }],
					} as Element,
				],
			};

			const transform = rehypeToc();
			transform(tree);

			const h2First = tree.children[1] as Element;
			const h2Second = tree.children[2] as Element;

			expect(h2First.properties?.id).not.toBe(h2Second.properties?.id);
		});
	});
});
