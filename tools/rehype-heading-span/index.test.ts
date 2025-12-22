import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import rehypeHeadingSpan from "./index.ts";

const createHeadingTree = (tagName: string, text: string): Root => ({
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

describe("rehype-heading-span", () => {
	describe("basic functionality", () => {
		it("should wrap h1 content with span", () => {
			const tree = createHeadingTree("h1", "Title");
			const transform = rehypeHeadingSpan();

			transform(tree);

			const h1 = tree.children[0] as Element;
			expect(h1.tagName).toBe("h1");
			expect(h1.children.length).toBe(1);

			const span = h1.children[0] as Element;
			expect(span.tagName).toBe("span");

			const text = span.children[0] as Text;
			expect(text.value).toBe("Title");
		});

		it("should wrap h2 content with span", () => {
			const tree = createHeadingTree("h2", "Section");
			const transform = rehypeHeadingSpan();

			transform(tree);

			const h2 = tree.children[0] as Element;
			const span = h2.children[0] as Element;
			expect(span.tagName).toBe("span");
		});

		it("should wrap all heading levels (h1-h6)", () => {
			const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];

			for (const tag of headings) {
				const tree = createHeadingTree(tag, "Test");
				const transform = rehypeHeadingSpan();

				transform(tree);

				const heading = tree.children[0] as Element;
				const span = heading.children[0] as Element;
				expect(span.tagName).toBe("span");
			}
		});
	});

	describe("skip cases", () => {
		it("should not wrap non-heading elements", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "element",
						tagName: "p",
						properties: {},
						children: [{ type: "text", value: "Paragraph" }],
					} as Element,
				],
			};

			const transform = rehypeHeadingSpan();
			transform(tree);

			const p = tree.children[0] as Element;
			// pの子要素がspan でなくtextのままであることを確認
			expect(p.children[0].type).toBe("text");
		});
	});
});
