import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

/**
 * Rehype plugin to add favicon images as prefixes to external links.
 * Uses Google's favicon service to fetch favicons at view time.
 */
export default function rehypeExternalLinkFavicon() {
	return (tree: Root) => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "a" || !parent || typeof index !== "number") {
				return;
			}

			const href = node.properties?.href;
			if (typeof href !== "string") {
				return;
			}

			// Check if it's an external link
			if (!isExternalLink(href)) {
				return;
			}

			// Skip certain link types that shouldn't have favicons
			const className = node.properties?.className;
			if (Array.isArray(className)) {
				const skipClasses = ["icon-link", "link-card", "share-button"];
				if (skipClasses.some((c) => className.includes(c))) {
					return;
				}
			}

			// Check if link already contains an image (don't add favicon to image links)
			if (hasImageChild(node)) {
				return;
			}

			// Extract domain from URL
			let domain: string;
			try {
				const url = new URL(href);
				domain = url.hostname;
			} catch {
				return; // Invalid URL, skip
			}

			// Create favicon image element
			const faviconImg: Element = {
				type: "element",
				tagName: "img",
				properties: {
					src: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
					alt: "",
					className: ["external-link-favicon"],
					width: 14,
					height: 14,
					loading: "lazy",
					decoding: "async",
				},
				children: [],
			};

			// Prepend favicon to link content
			node.children = [faviconImg, ...node.children];
		});
	};
}

function isExternalLink(href: string): boolean {
	// External links start with http:// or https://
	if (!href.startsWith("http://") && !href.startsWith("https://")) {
		return false;
	}

	// Exclude own domain
	try {
		const url = new URL(href);
		if (url.hostname === "maguro.dev" || url.hostname.endsWith(".maguro.dev")) {
			return false;
		}
	} catch {
		return false;
	}

	return true;
}

function hasImageChild(node: Element): boolean {
	for (const child of node.children) {
		if (child.type === "element") {
			if (child.tagName === "img") {
				return true;
			}
			if (hasImageChild(child)) {
				return true;
			}
		}
	}
	return false;
}
