import { describe, it, expect } from "vitest";
import type { Root, Text as MdastText, Html } from "mdast";
import remarkBudoux from "./index.ts";

describe("remark-budoux", () => {
	describe("basic functionality", () => {
		it("should convert text node to html node with budoux processing", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [
							{
								type: "text",
								value: "これはテストです",
							} as MdastText,
						],
					},
				],
			};

			const transform = remarkBudoux();
			transform(tree);

			const paragraph = tree.children[0] as { children: (MdastText | Html)[] };
			const htmlNode = paragraph.children[0] as Html;

			expect(htmlNode.type).toBe("html");
			// BudouXはwbrタグを挿入するので、元のテキストと異なるはず
			expect(htmlNode.value).toContain("これは");
		});

		it("should not process empty text nodes", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [
							{
								type: "text",
								value: "   ",
							} as MdastText,
						],
					},
				],
			};

			const transform = remarkBudoux();
			transform(tree);

			const paragraph = tree.children[0] as { children: MdastText[] };
			// 空白のみのテキストは変換されない
			expect(paragraph.children[0].type).toBe("text");
		});
	});
});
