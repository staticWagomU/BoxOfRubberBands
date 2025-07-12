import { visit } from "unist-util-visit";

export default function codeBlockPlugin() {
	return (tree) => {
		visit(tree, "code", (node, index, parent) => {
			const lang = node.lang || "plaintext";

			if (node.meta) {
				const titleMatch = node.meta.match(/title=["']([^"']*)["']/);
				const title = titleMatch ? titleMatch[1] : "";
				const codeBlockWithTitle = {
					type: "html",
					value: createCodeBlockWithTitle(lang, title, node.value),
				};
				parent.children.splice(index, 1, codeBlockWithTitle);
			} else {
				const codeBlock = {
					type: "html",
					value: `<pre><code class="language-${lang}">${escapeHtml(node.value)}</code></pre>`,
				};
				parent.children.splice(index, 1, codeBlock);
			}
		});
	};
}

function createCodeBlockWithTitle(lang, title, code) {
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

function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
