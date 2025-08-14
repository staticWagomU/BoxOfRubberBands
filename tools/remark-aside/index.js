import { visit } from "unist-util-visit";

export default function remarkAside() {
	return function transformer(tree) {
		visit(tree, ["paragraph", "text"], (node, index, parent) => {
			// Handle text nodes (existing functionality)
			if (node.type === "text") {
				const value = node.value;
				const reg = /^:::\s*(\w+)[\s\S]*?\r?\n([\s\S]*?)\r?\n:::/;
				const match = value.match(reg);
				if (!match) {
					return;
				}
				const type = match[1];
				const content = match[2];
				const start = node.position.start;
				const end = node.position.end;
				const aside = {
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
									value: getType(type),
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
						},
					],
					data: {
						hName: "aside",
						hProperties: { className: ["directive", type.toLowerCase()] },
					},
					position: {
						start,
						end,
					},
				};

				parent.children.splice(index, 1, aside);
				return;
			}

			// Handle paragraph nodes
			if (node.type === "paragraph" && node.children && node.children.length > 0) {
				// Check if the paragraph starts with aside syntax
				const firstChild = node.children[0];
				if (firstChild.type !== "text" || !firstChild.value.startsWith(":::")) {
					return;
				}

				// Check if the paragraph ends with :::
				const lastChild = node.children[node.children.length - 1];
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
				const contentChildren = [];

				// Special case: single text node containing the entire aside
				if (node.children.length === 1 && node.children[0].type === "text") {
					const textNode = node.children[0];
					const contentMatch = textNode.value.match(/^:::\s*\w+\s*\n([\s\S]*?)\n?:::$/);
					if (contentMatch) {
						contentChildren.push({
							type: "text",
							value: contentMatch[1],
						});
					}
				} else {
					// Multiple nodes case
					for (let i = 0; i < node.children.length; i++) {
						const child = node.children[i];
						if (i === 0 && child.type === "text") {
							// Remove the opening ::: from the first text node
							const newValue = child.value.replace(/^:::\s*\w+\s*\n?/, "");
							if (newValue) {
								contentChildren.push({
									...child,
									value: newValue,
								});
							}
						} else if (i === node.children.length - 1 && child.type === "text") {
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

				// Create the aside node
				const aside = {
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
									value: getType(type),
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
						},
					],
					data: {
						hName: "aside",
						hProperties: { className: ["directive", type.toLowerCase()] },
					},
					position: node.position,
				};

				// Replace the paragraph with the aside
				parent.children.splice(index, 1, aside);
			}
		});
	};
}

function getType(type) {
	switch (type.toLowerCase()) {
		case "tips":
			return "ヒント";
		case "warning":
			return "警告";
		case "note":
			return "注意";
		case "info":
			return "情報";
		default:
			return type;
	}
}
