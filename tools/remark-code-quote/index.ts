import { visit } from "unist-util-visit";
import type { Root, Code, Html, Parent } from "mdast";

/**
 * Remarkプラグイン: コードブロックをHTMLに変換
 * meta属性からtitleを抽出し、タイトル付きのコードブロックを生成
 */
export default function remarkCodeQuote() {
	return (tree: Root) => {
		visit(tree, "code", (node: Code, index: number | undefined, parent: Parent | undefined) => {
			if (!parent || typeof index !== "number") return;

			const lang = node.lang || "plaintext";

			if (node.meta) {
				const titleMatch = node.meta.match(/title=["']([^"']*)["']/);
				const title = titleMatch ? titleMatch[1] : "";
				const codeBlockWithTitle: Html = {
					type: "html",
					value: createCodeBlockWithTitle(lang, title, node.value),
				};
				parent.children.splice(index, 1, codeBlockWithTitle);
			} else {
				const codeBlock: Html = {
					type: "html",
					value: `<pre><code class="language-${lang}">${escapeHtml(node.value)}</code></pre>`,
				};
				parent.children.splice(index, 1, codeBlock);
			}
		});
	};
}

function createCodeBlockWithTitle(lang: string, title: string, code: string): string {
	const titleElement = title
		? `<span class="code-block-title-wrapper"><div class="code-block-title">${title}</div></span>`
		: "";

	return `
<div class="code-block-with-title">
  ${titleElement}
  <pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>
</div>
`.trim();
}

function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
