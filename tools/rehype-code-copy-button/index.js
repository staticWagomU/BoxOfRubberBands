import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";

/**
 * Rehypeプラグイン: コードブロックにコピーボタンを追加
 * @param {object} options - プラグインのオプション
 * @param {string} options.buttonClassName - コピーボタン用のCSSクラス名 (デフォルト: 'copy-button')
 * @param {string} options.buttonText - コピーボタンのテキスト (デフォルト: 'Copy')
 * @param {string} options.buttonSuccessText - コピー成功時のテキスト (デフォルト: 'Copied!')
 * @param {number} options.successDuration - 成功メッセージの表示時間(ms) (デフォルト: 2000)
 * @returns {function} Unified/Rehypeトランスフォーマー
 */
export default function rehypeCodeCopyButton(options = {}) {
	const {
		buttonClassName = "copy-button",
		buttonText = "Copy",
		buttonSuccessText = "Copied!",
		successDuration = 2000,
	} = options;

	return (tree) => {
		visit(tree, "element", (node) => {
			// pre > code のパターンを探す
			if (node.tagName !== "pre" || !node.children?.[0]?.tagName === "code") {
				return;
			}

			// すでにラップされている場合はスキップ
			if (node.properties?.className?.includes("code-block-wrapper")) {
				return;
			}

			// const codeNode = node.children[0];

			// コードのテキストを取得
			// const code = toString(codeNode);

			// 相対的な位置指定のために親要素をposition: relativeに
			node.properties = node.properties || {};
			node.properties.className = node.properties.className || [];
			if (!Array.isArray(node.properties.className)) {
				node.properties.className = [node.properties.className];
			}
			node.properties.className.push("code-block-with-copy");

			// コピーボタンを作成
			const copyButton = {
				type: "element",
				tagName: "button",
				properties: {
					className: [buttonClassName],
					"aria-label": "コードをクリップボードにコピー",
					"data-copy-text": buttonText,
					"data-success-text": buttonSuccessText,
					"data-success-duration": successDuration,
					onClick: {
						type: "raw",
						value: `(function() {
              const button = this;
              const pre = button.closest("pre");
              const code = pre.querySelector("code").innerText;
              
              navigator.clipboard.writeText(code).then(() => {
                button.textContent = button.dataset.successText;
                button.classList.add("copied");
                
                setTimeout(() => {
                  button.textContent = button.dataset.copyText;
                  button.classList.remove("copied");
                }, parseInt(button.dataset.successDuration, 10));
              }).catch((err) => {
                console.error("Could not copy text: ", err);
              });
            })()`,
					},
				},
				children: [
					{
						type: "text",
						value: buttonText,
					},
				],
			};

			// ボタンをpre要素に追加
			node.children.push(copyButton);
		});

		// インラインスクリプトを追加
		// コピー機能のためのスクリプトを追加
		const inlineScript = {
			type: "element",
			tagName: "script",
			properties: {},
			children: [
				{
					type: "text",
					value: `
          document.addEventListener("DOMContentLoaded", () => {
            document.querySelectorAll(".${buttonClassName}").forEach(button => {
              button.addEventListener("click", () => {
                const pre = button.closest("pre");
                const code = pre.querySelector("code").innerText;
                
                navigator.clipboard.writeText(code).then(() => {
                  button.textContent = button.dataset.successText;
                  button.classList.add("copied");
                  
                  setTimeout(() => {
                    button.textContent = button.dataset.copyText;
                    button.classList.remove("copied");
                  }, parseInt(button.dataset.successDuration, 10));
                }).catch(err => {
                  console.error("Could not copy text: ", err);
                });
              });
            });
          });
          `,
				},
			],
		};

		// body要素にスクリプトを追加
		// ただし、AstroではこのスクリプトはCSSとともにレイアウトコンポーネントに含めるべき
		// このコメントはその助言を記載
		tree.children.push({
			type: "comment",
			value: ` 
      Note: For Astro integration, add this CSS to your styles:
      
      .code-block-with-copy {
        position: relative;
      }
      
      .copy-button {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.1);
        border: none;
        border-radius: 4px;
        font-size: 0.8rem;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .code-block-with-copy:hover .copy-button {
        opacity: 1;
      }
      
      .copy-button.copied {
        background: #4caf50;
        color: white;
      }
      `,
		});

		// tree.children.push(inlineScript);
	};
}
