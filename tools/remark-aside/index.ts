import { visit } from "unist-util-visit";
import type { Root, Parent, Text as MdastText, Paragraph, RootContent, Code } from "mdast";

type AsideType = "tips" | "warning" | "note" | "info";

interface ContainerNode {
	type: "container";
	children: (ContainerNode | MdastText | Paragraph | Code | RootContent)[];
	data?: {
		hName?: string;
		hProperties?: { className?: string[] };
	};
	position?: {
		start: { line: number; column: number; offset?: number };
		end: { line: number; column: number; offset?: number };
	};
}

/**
 * Remarkプラグイン: :::記法でasideブロックを生成
 * ::: info / ::: tips / ::: warning / ::: note をサポート
 * コードブロックを含むasideにも対応
 */
export default function remarkAside() {
	return function transformer(tree: Root) {
		// Phase 1: Handle multi-node asides (containing code blocks, etc.)
		processMultiNodeAsides(tree);

		// Phase 2: Handle single-node asides (existing functionality)
		visit(tree, ["paragraph", "text"], (node, index, parent) => {
			if (!parent || typeof index !== "number") return;

			// Handle text nodes (existing functionality)
			if (node.type === "text") {
				const textNode = node as MdastText;
				const value = textNode.value;
				const reg = /^:::\s*(\w+)[\s\S]*?\r?\n([\s\S]*?)\r?\n:::/;
				const match = value.match(reg);
				if (!match) {
					return;
				}
				const type = match[1];
				const content = match[2];
				const start = textNode.position?.start ?? { line: 0, column: 0 };
				const end = textNode.position?.end ?? { line: 0, column: 0 };
				const aside = createAsideNode(type, content, { start, end });

				(parent as Parent).children.splice(index, 1, aside as unknown as typeof node);
				return;
			}

			// Handle paragraph nodes
			if (node.type === "paragraph") {
				const paragraphNode = node as Paragraph;
				if (!paragraphNode.children || paragraphNode.children.length === 0) {
					return;
				}

				// Check if the paragraph starts with aside syntax
				const firstChild = paragraphNode.children[0];
				if (firstChild.type !== "text" || !firstChild.value.startsWith(":::")) {
					return;
				}

				// Check if the paragraph ends with :::
				const lastChild = paragraphNode.children[paragraphNode.children.length - 1];
				const endsWithClosing = lastChild.type === "text" && lastChild.value.endsWith(":::");

				if (!endsWithClosing) {
					return;
				}

				// Extract the type from the first text node
				const typeMatch = firstChild.value.match(/^:::\s*(\w+)/);
				if (!typeMatch) {
					return;
				}

				const type = typeMatch[1];

				// Process children to extract content
				const contentChildren: (MdastText | (typeof paragraphNode.children)[0])[] = [];

				// Special case: single text node containing the entire aside
				if (paragraphNode.children.length === 1 && paragraphNode.children[0].type === "text") {
					const textNode = paragraphNode.children[0];
					const contentMatch = textNode.value.match(/^:::\s*\w+\s*\n([\s\S]*?)\n?:::$/);
					if (contentMatch) {
						contentChildren.push({
							type: "text",
							value: contentMatch[1],
						});
					}
				} else {
					// Multiple nodes case
					for (let i = 0; i < paragraphNode.children.length; i++) {
						const child = paragraphNode.children[i];
						if (i === 0 && child.type === "text") {
							// Remove the opening ::: from the first text node
							const newValue = child.value.replace(/^:::\s*\w+\s*\n?/, "");
							if (newValue) {
								contentChildren.push({
									...child,
									value: newValue,
								});
							}
						} else if (i === paragraphNode.children.length - 1 && child.type === "text") {
							// Remove the closing ::: from the last text node
							const newValue = child.value.replace(/\n?:::$/, "");
							if (newValue) {
								contentChildren.push({
									...child,
									value: newValue,
								});
							}
						} else {
							contentChildren.push(child);
						}
					}
				}

				// Create the aside node with proper content children
				const aside = createAsideNodeWithChildren(type, contentChildren, paragraphNode.position);

				// Replace the paragraph with the aside
				(parent as Parent).children.splice(index, 1, aside as unknown as typeof node);
			}
		});
	};
}

/**
 * Process asides that span multiple nodes (e.g., containing code blocks)
 */
function processMultiNodeAsides(tree: Root): void {
	const children = tree.children;
	let i = 0;

	while (i < children.length) {
		const node = children[i];

		// Look for a paragraph that starts with ::: but doesn't end with :::
		if (node.type === "paragraph") {
			const paragraph = node as Paragraph;
			const firstChild = paragraph.children[0];

			if (firstChild?.type === "text" && firstChild.value.match(/^:::\s*(\w+)/)) {
				// Check if this paragraph contains the closing :::
				const lastChild = paragraph.children[paragraph.children.length - 1];
				const selfContained = lastChild?.type === "text" && lastChild.value.endsWith(":::");

				if (!selfContained) {
					// This is a multi-node aside - find the closing :::
					const result = findClosingAndCollect(children, i);

					if (result) {
						const { endIndex, asideType, collectedNodes, startParagraph, endParagraph } = result;

						// Create the aside node
						const aside = createMultiNodeAside(
							asideType,
							startParagraph,
							collectedNodes,
							endParagraph,
							{
								start: node.position?.start ?? { line: 0, column: 0 },
								end: children[endIndex].position?.end ?? { line: 0, column: 0 },
							}
						);

						// Replace the nodes with the aside
						const removeCount = endIndex - i + 1;
						children.splice(i, removeCount, aside as unknown as RootContent);
						continue;
					}
				}
			}
		}

		i++;
	}
}

/**
 * Find the closing ::: and collect all nodes in between
 */
function findClosingAndCollect(
	children: RootContent[],
	startIndex: number
): {
	endIndex: number;
	asideType: string;
	collectedNodes: RootContent[];
	startParagraph: Paragraph;
	endParagraph: Paragraph;
} | null {
	const startParagraph = children[startIndex] as Paragraph;
	const firstChild = startParagraph.children[0] as MdastText;
	const typeMatch = firstChild.value.match(/^:::\s*(\w+)/);

	if (!typeMatch) return null;

	const asideType = typeMatch[1];
	const collectedNodes: RootContent[] = [];

	for (let i = startIndex + 1; i < children.length; i++) {
		const node = children[i];

		// Check if this is the closing paragraph
		if (node.type === "paragraph") {
			const paragraph = node as Paragraph;
			const lastChild = paragraph.children[paragraph.children.length - 1];

			if (lastChild?.type === "text" && lastChild.value.endsWith(":::")) {
				// Check if the paragraph only contains :::
				if (paragraph.children.length === 1 && lastChild.value === ":::") {
					return {
						endIndex: i,
						asideType,
						collectedNodes,
						startParagraph,
						endParagraph: paragraph,
					};
				}

				// The closing paragraph has content before :::
				return {
					endIndex: i,
					asideType,
					collectedNodes,
					startParagraph,
					endParagraph: paragraph,
				};
			}
		}

		collectedNodes.push(node);
	}

	return null;
}

/**
 * Create an aside node from multiple source nodes
 */
function createMultiNodeAside(
	type: string,
	startParagraph: Paragraph,
	middleNodes: RootContent[],
	endParagraph: Paragraph,
	position: ContainerNode["position"]
): ContainerNode {
	const contentChildren: RootContent[] = [];

	// Process start paragraph - remove ::: type from the beginning
	const startFirstChild = startParagraph.children[0] as MdastText;
	const cleanedStartText = startFirstChild.value.replace(/^:::\s*\w+\s*\n?/, "");

	if (cleanedStartText || startParagraph.children.length > 1) {
		const newStartChildren = [...startParagraph.children];
		if (cleanedStartText) {
			newStartChildren[0] = { ...startFirstChild, value: cleanedStartText };
		} else {
			newStartChildren.shift();
		}

		if (newStartChildren.length > 0) {
			contentChildren.push({
				...startParagraph,
				children: newStartChildren,
			} as Paragraph);
		}
	}

	// Add middle nodes (code blocks, paragraphs, etc.)
	contentChildren.push(...middleNodes);

	// Process end paragraph - remove ::: from the end
	const endLastChild = endParagraph.children[endParagraph.children.length - 1] as MdastText;
	const cleanedEndText = endLastChild.value.replace(/\n?:::$/, "");

	if (cleanedEndText || endParagraph.children.length > 1) {
		const newEndChildren = [...endParagraph.children];
		if (cleanedEndText) {
			newEndChildren[newEndChildren.length - 1] = { ...endLastChild, value: cleanedEndText };
		} else {
			newEndChildren.pop();
		}

		if (newEndChildren.length > 0) {
			contentChildren.push({
				...endParagraph,
				children: newEndChildren,
			} as Paragraph);
		}
	}

	return {
		type: "container",
		children: [
			{
				type: "container",
				children: [
					{
						type: "container",
						children: [],
						data: {
							hName: "span",
							hProperties: { className: ["icon"] },
						},
					},
					{
						type: "text",
						value: getTypeLabel(type),
					},
				],
				data: {
					hName: "div",
					hProperties: { className: ["aside-title"] },
				},
			},
			{
				type: "container",
				children: contentChildren,
				data: {
					hName: "div",
					hProperties: { className: ["aside-content"] },
				},
			},
		],
		data: {
			hName: "aside",
			hProperties: { className: ["directive", type.toLowerCase()] },
		},
		position,
	};
}

function createAsideNode(
	type: string,
	content: string,
	position: ContainerNode["position"]
): ContainerNode {
	return {
		type: "container",
		children: [
			{
				type: "container",
				children: [
					{
						type: "container",
						children: [],
						data: {
							hName: "span",
							hProperties: { className: ["icon"] },
						},
					},
					{
						type: "text",
						value: getTypeLabel(type),
					},
				],
				data: {
					hName: "div",
					hProperties: { className: ["aside-title"] },
				},
			},
			{
				type: "paragraph",
				children: [
					{
						type: "text",
						value: content,
					},
				],
				data: { hProperties: { className: ["aside-content"] } },
			} as Paragraph,
		],
		data: {
			hName: "aside",
			hProperties: { className: ["directive", type.toLowerCase()] },
		},
		position,
	};
}

function createAsideNodeWithChildren(
	type: string,
	contentChildren: unknown[],
	position?: Paragraph["position"]
): ContainerNode {
	return {
		type: "container",
		children: [
			{
				type: "container",
				children: [
					{
						type: "container",
						children: [],
						data: {
							hName: "span",
							hProperties: { className: ["icon"] },
						},
					},
					{
						type: "text",
						value: getTypeLabel(type),
					},
				],
				data: {
					hName: "div",
					hProperties: { className: ["aside-title"] },
				},
			},
			{
				type: "paragraph",
				children: contentChildren,
				data: { hProperties: { className: ["aside-content"] } },
			} as Paragraph,
		],
		data: {
			hName: "aside",
			hProperties: { className: ["directive", type.toLowerCase()] },
		},
		position,
	};
}

function getTypeLabel(type: string): string {
	const labels: Record<AsideType, string> = {
		tips: "ヒント",
		warning: "警告",
		note: "注意",
		info: "情報",
	};
	return labels[type.toLowerCase() as AsideType] ?? type;
}
