import { describe, it, expect } from "vitest";
import type { Root, Code, Html } from "mdast";
import remarkCodeQuote from "./index.ts";

describe("remark-code-quote", () => {
	describe("basic functionality", () => {
		it("should convert code block to html with language class", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "code",
						lang: "javascript",
						value: 'console.log("hello");',
					} as Code,
				],
			};

			const transform = remarkCodeQuote();
			transform(tree);

			const htmlNode = tree.children[0] as Html;
			expect(htmlNode.type).toBe("html");
			expect(htmlNode.value).toContain('class="language-javascript"');
			expect(htmlNode.value).toContain("console.log");
		});

		it("should use plaintext as default language", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "code",
						value: "some text",
					} as Code,
				],
			};

			const transform = remarkCodeQuote();
			transform(tree);

			const htmlNode = tree.children[0] as Html;
			expect(htmlNode.value).toContain('class="language-plaintext"');
		});
	});

	describe("title support", () => {
		it("should add title wrapper when title meta is present", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "code",
						lang: "typescript",
						meta: 'title="example.ts"',
						value: "const x = 1;",
					} as Code,
				],
			};

			const transform = remarkCodeQuote();
			transform(tree);

			const htmlNode = tree.children[0] as Html;
			expect(htmlNode.value).toContain('class="code-block-with-title"');
			expect(htmlNode.value).toContain('class="code-block-title"');
			expect(htmlNode.value).toContain("example.ts");
		});

		it("should support single quotes in title meta", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "code",
						lang: "python",
						meta: "title='script.py'",
						value: "print('hello')",
					} as Code,
				],
			};

			const transform = remarkCodeQuote();
			transform(tree);

			const htmlNode = tree.children[0] as Html;
			expect(htmlNode.value).toContain("script.py");
		});
	});

	describe("HTML escaping", () => {
		it("should escape HTML special characters in code", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "code",
						lang: "html",
						value: '<div class="test">Hello & World</div>',
					} as Code,
				],
			};

			const transform = remarkCodeQuote();
			transform(tree);

			const htmlNode = tree.children[0] as Html;
			expect(htmlNode.value).toContain("&lt;div");
			expect(htmlNode.value).toContain("&gt;");
			expect(htmlNode.value).toContain("&amp;");
			expect(htmlNode.value).toContain("&quot;");
		});
	});
});
