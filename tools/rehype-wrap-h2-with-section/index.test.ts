import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeWrapH2WithSection from "./index.ts";

describe("rehype-wrap-h2-with-section", () => {
	describe("basic functionality", () => {
		it("should wrap h2 and following content in section", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "h2",
						properties: {},
						children: [{ type: "text", value: "Section 1" }],
					} as Element,
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "Content 1" }],
					} as Element,
				],
			};

			const transform = rehypeWrapH2WithSection();
			transform(tree);

			expect(tree.children.length).toBe(1);

			const section = tree.children[0] as Element;
			expect(section.tagName).toBe("section");
			expect(section.properties?.className).toContain("blog-section");
			expect(section.children.length).toBe(2); // h2 + p
		});

		it("should create multiple sections for multiple h2s", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "h2",
						properties: {},
						children: [{ type: "text", value: "Section 1" }],
					} as Element,
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "Content 1" }],
					} as Element,
					{
						type: "element",
						tagName: "h2",
						properties: {},
						children: [{ type: "text", value: "Section 2" }],
					} as Element,
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "Content 2" }],
					} as Element,
				],
			};

			const transform = rehypeWrapH2WithSection();
			transform(tree);

			expect(tree.children.length).toBe(2);

			const section1 = tree.children[0] as Element;
			const section2 = tree.children[1] as Element;

			expect(section1.tagName).toBe("section");
			expect(section2.tagName).toBe("section");
		});

		it("should keep content before first h2 unwrapped", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "Intro" }],
					} as Element,
					{
						type: "element",
						tagName: "h2",
						properties: {},
						children: [{ type: "text", value: "Section 1" }],
					} as Element,
				],
			};

			const transform = rehypeWrapH2WithSection();
			transform(tree);

			expect(tree.children.length).toBe(2);

			// 最初の要素はpのまま
			const intro = tree.children[0] as Element;
			expect(intro.tagName).toBe("p");

			// 2番目の要素はsection
			const section = tree.children[1] as Element;
			expect(section.tagName).toBe("section");
		});
	});

	describe("edge cases", () => {
		it("should handle tree with no h2", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "No sections" }],
					} as Element,
				],
			};

			const transform = rehypeWrapH2WithSection();
			transform(tree);

			expect(tree.children.length).toBe(1);
			const p = tree.children[0] as Element;
			expect(p.tagName).toBe("p");
		});
	});
});
