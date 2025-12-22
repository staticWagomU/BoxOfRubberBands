import type { Root, Element, RootContent } from "hast";

/**
 * Rehypeプラグイン: h2見出しごとにsection要素でラップ
 * h2が出現するたびに新しいsectionを開始し、次のh2までの内容を含める
 */
export default function rehypeWrapH2WithSection() {
	return (tree: Root) => {
		const sections: RootContent[] = [];
		let currentSection: Element | null = null;

		tree.children.forEach((node) => {
			if (node.type === "element" && node.tagName === "h2") {
				// 現在のセクションがあれば保存
				if (currentSection) {
					sections.push(currentSection);
				}
				// 新しいセクションを開始
				currentSection = {
					type: "element",
					tagName: "section",
					properties: { className: ["blog-section"] },
					children: [node],
				};
			} else if (currentSection) {
				// 現在のセクションに追加
				currentSection.children.push(node);
			} else {
				// h2が出現する前の要素はそのまま追加
				sections.push(node);
			}
		});

		// 最後のセクションを追加
		if (currentSection) {
			sections.push(currentSection);
		}

		tree.children = sections;
	};
}
