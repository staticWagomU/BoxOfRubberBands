import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkAside from "./index.ts";
import remarkHtml from "remark-html";

const processMarkdown = async (markdown: string): Promise<string> => {
	const file = await unified()
		.use(remarkParse)
		.use(remarkAside)
		.use(remarkHtml, { sanitize: false })
		.process(markdown);
	return String(file);
};

describe("remark-aside", () => {
	describe("existing functionality", () => {
		it("should transform simple info aside", async () => {
			const markdown = `::: info
This is an information message.
:::`;
			const html = await processMarkdown(markdown);
			expect(html).toContain('<aside class="directive info">');
			expect(html).toContain('<div class="aside-title">');
			expect(html).toContain('<span class="icon"></span>情報');
			expect(html).toContain('<p class="aside-content">This is an information message.</p>');
		});

		it("should transform tips aside", async () => {
			const markdown = `::: tips
This is a helpful tip.
:::`;
			const html = await processMarkdown(markdown);
			expect(html).toContain('<aside class="directive tips">');
			expect(html).toContain('<span class="icon"></span>ヒント');
			expect(html).toContain('<p class="aside-content">This is a helpful tip.</p>');
		});

		it("should transform warning aside", async () => {
			const markdown = `::: warning
This is a warning message.
:::`;
			const html = await processMarkdown(markdown);
			expect(html).toContain('<aside class="directive warning">');
			expect(html).toContain('<span class="icon"></span>警告');
			expect(html).toContain('<p class="aside-content">This is a warning message.</p>');
		});

		it("should transform note aside", async () => {
			const markdown = `::: note
This is a note.
:::`;
			const html = await processMarkdown(markdown);
			expect(html).toContain('<aside class="directive note">');
			expect(html).toContain('<span class="icon"></span>注意');
			expect(html).toContain('<p class="aside-content">This is a note.</p>');
		});

		it("should handle unknown aside types", async () => {
			const markdown = `::: custom
This is a custom aside.
:::`;
			const html = await processMarkdown(markdown);
			expect(html).toContain('<aside class="directive custom">');
			expect(html).toContain('<span class="icon"></span>custom');
			expect(html).toContain('<p class="aside-content">This is a custom aside.</p>');
		});

		it("should handle multiline content", async () => {
			const markdown = `::: info
Line 1
Line 2
Line 3
:::`;
			const html = await processMarkdown(markdown);
			expect(html).toContain('<aside class="directive info">');
			expect(html).toContain("Line 1\nLine 2\nLine 3");
		});
	});

	describe("markdown content support", () => {
		it("should handle aside with markdown links", async () => {
			const markdown = `::: info
この記事は[Vim駅伝](https://vim-jp.org/ekiden/)2025年3月7日(金)の記事です。
前回の記事は [kuuote](https://github.com/kuuote) さんの「[:%!xxx-fmtをいい感じにスクリプトでやる](https://zenn.dev/vim_jp/articles/20250305_ekiden_vim_script_format)」という記事でした。
次回の記事は 3月10日(月) に投稿される予定です。
:::`;
			const html = await processMarkdown(markdown);

			// Should contain aside structure
			expect(html).toContain('<aside class="directive info">');
			expect(html).toContain('<span class="icon"></span>情報');

			// Should preserve markdown links
			expect(html).toContain('<a href="https://vim-jp.org/ekiden/">Vim駅伝</a>');
			expect(html).toContain('<a href="https://github.com/kuuote">kuuote</a>');
			expect(html).toContain(
				'<a href="https://zenn.dev/vim_jp/articles/20250305_ekiden_vim_script_format">:%!xxx-fmtをいい感じにスクリプトでやる</a>'
			);
		});

		it("should handle aside with bold and italic text", async () => {
			const markdown = `::: tips
This is **bold** and *italic* text.
:::`;
			const html = await processMarkdown(markdown);

			expect(html).toContain('<aside class="directive tips">');
			expect(html).toContain("<strong>bold</strong>");
			expect(html).toContain("<em>italic</em>");
		});

		it("should handle aside with inline code", async () => {
			const markdown = `::: note
Use \`npm install\` to install dependencies.
:::`;
			const html = await processMarkdown(markdown);

			expect(html).toContain('<aside class="directive note">');
			expect(html).toContain("<code>npm install</code>");
		});
	});

	describe("code block support", () => {
		it("should handle aside with fenced code block", async () => {
			const markdown = `::: warning
以下のようなWARNINGが表示されます。
\`\`\`
WARNING: A terminally deprecated method
\`\`\`
:::`;
			const html = await processMarkdown(markdown);

			expect(html).toContain('<aside class="directive warning">');
			expect(html).toContain('<span class="icon"></span>警告');
			expect(html).toContain("以下のようなWARNINGが表示されます。");
			expect(html).toContain("<code>");
			expect(html).toContain("WARNING: A terminally deprecated method");
		});

		it("should handle aside with code block with language", async () => {
			const markdown = `::: tips
コードサンプル：
\`\`\`typescript
const x: number = 42;
\`\`\`
:::`;
			const html = await processMarkdown(markdown);

			expect(html).toContain('<aside class="directive tips">');
			expect(html).toContain("const x: number = 42;");
		});

		it("should handle aside with multiple code blocks", async () => {
			const markdown = `::: info
入力：
\`\`\`
input data
\`\`\`
出力：
\`\`\`
output data
\`\`\`
:::`;
			const html = await processMarkdown(markdown);

			expect(html).toContain('<aside class="directive info">');
			expect(html).toContain("input data");
			expect(html).toContain("output data");
		});

		it("should handle aside with code block and markdown formatting", async () => {
			const markdown = `::: note
**重要**: 以下のコマンドを実行してください。
\`\`\`bash
npm install
\`\`\`
詳しくは[ドキュメント](https://example.com)を参照。
:::`;
			const html = await processMarkdown(markdown);

			expect(html).toContain('<aside class="directive note">');
			expect(html).toContain("<strong>重要</strong>");
			expect(html).toContain("npm install");
			expect(html).toContain('<a href="https://example.com">ドキュメント</a>');
		});
	});
});
