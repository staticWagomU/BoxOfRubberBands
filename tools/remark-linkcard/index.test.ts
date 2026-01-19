import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Root, Paragraph, Link, Text } from "mdast";
import {
	decodeHtmlEntities,
	escapeHtml,
	extractMetaContent,
	isCacheValid,
	isStandaloneUrlParagraph,
	collectStandaloneUrls,
	generateLinkCardHtml,
	generateHeadlessHtml,
	generateMarkerHtml,
	generateFallbackLinkHtml,
	fetchOGP,
	loadCache,
	saveCache,
	remarkLinkCard,
	clearCacheManager,
	type LinkCardMetadata,
	type LinkCardCache,
} from "./index.ts";
import fs from "node:fs";

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe("remark-linkcard", () => {
	describe("decodeHtmlEntities", () => {
		it("should decode &amp; to &", () => {
			expect(decodeHtmlEntities("foo &amp; bar")).toBe("foo & bar");
		});

		it("should decode &lt; and &gt;", () => {
			expect(decodeHtmlEntities("&lt;div&gt;")).toBe("<div>");
		});

		it("should decode &quot; and &#39;", () => {
			expect(decodeHtmlEntities("say &quot;hello&quot; and &#39;world&#39;")).toBe(
				"say \"hello\" and 'world'"
			);
		});

		it("should decode decimal numeric references", () => {
			expect(decodeHtmlEntities("&#60;&#62;")).toBe("<>");
		});

		it("should decode hexadecimal numeric references", () => {
			expect(decodeHtmlEntities("&#x3C;&#x3E;")).toBe("<>");
			expect(decodeHtmlEntities("&#x3c;&#x3e;")).toBe("<>"); // lowercase
		});

		it("should handle mixed entities", () => {
			// &amp;lt; → &lt; (after &amp; becomes &), then &lt; → <
			// Since all replacements happen in sequence on the same string:
			// Step 1: &amp;lt; → &lt; (via &amp; → &)
			// Step 2: &lt; → < (via &lt; → <)
			// Final result: < means <
			expect(decodeHtmlEntities("&amp;lt; means &#60;")).toBe("< means <");
		});

		it("should decode nested entities correctly", () => {
			// Each entity is decoded in sequence
			// &amp; → &, &lt; → <
			expect(decodeHtmlEntities("&amp; and &lt;")).toBe("& and <");
		});

		it("should return unchanged text without entities", () => {
			expect(decodeHtmlEntities("plain text")).toBe("plain text");
		});
	});

	describe("escapeHtml", () => {
		it("should escape & to &amp;", () => {
			expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
		});

		it("should escape < and >", () => {
			expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
		});

		it("should escape double quotes", () => {
			expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
		});

		it("should escape single quotes", () => {
			expect(escapeHtml("'world'")).toBe("&#39;world&#39;");
		});

		it("should escape all special characters", () => {
			expect(escapeHtml('<script>alert("xss")</script>')).toBe(
				"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
			);
		});

		it("should return unchanged text without special chars", () => {
			expect(escapeHtml("plain text")).toBe("plain text");
		});
	});

	describe("extractMetaContent", () => {
		it("should extract content from first matching pattern", () => {
			const html = '<meta property="og:title" content="My Title">';
			const patterns = [/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i];
			expect(extractMetaContent(html, patterns)).toBe("My Title");
		});

		it("should fallback to second pattern if first fails", () => {
			const html = '<meta content="Fallback Title" property="og:title">';
			const patterns = [
				/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
				/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
			];
			expect(extractMetaContent(html, patterns)).toBe("Fallback Title");
		});

		it("should return empty string if no pattern matches", () => {
			const html = "<html><head></head></html>";
			const patterns = [/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i];
			expect(extractMetaContent(html, patterns)).toBe("");
		});

		it("should decode HTML entities in extracted content", () => {
			const html = '<meta property="og:title" content="Title &amp; Description">';
			const patterns = [/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i];
			expect(extractMetaContent(html, patterns)).toBe("Title & Description");
		});

		it("should trim whitespace from extracted content", () => {
			const html = '<meta property="og:title" content="  Spaced Title  ">';
			const patterns = [/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i];
			expect(extractMetaContent(html, patterns)).toBe("Spaced Title");
		});
	});

	describe("isCacheValid", () => {
		it("should return true for cache within max age", () => {
			const metadata: LinkCardMetadata = {
				url: "https://example.com",
				title: "Example",
				description: "",
				image: "",
				siteName: "example.com",
				fetchedAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
			};
			const maxAge = 60 * 1000; // 1 minute
			expect(isCacheValid(metadata, maxAge)).toBe(true);
		});

		it("should return false for expired cache", () => {
			const metadata: LinkCardMetadata = {
				url: "https://example.com",
				title: "Example",
				description: "",
				image: "",
				siteName: "example.com",
				fetchedAt: new Date(Date.now() - 120 * 1000).toISOString(), // 2 minutes ago
			};
			const maxAge = 60 * 1000; // 1 minute
			expect(isCacheValid(metadata, maxAge)).toBe(false);
		});

		it("should return false for exactly expired cache", () => {
			const fetchedAt = Date.now() - 60 * 1000; // exactly 1 minute ago
			const metadata: LinkCardMetadata = {
				url: "https://example.com",
				title: "Example",
				description: "",
				image: "",
				siteName: "example.com",
				fetchedAt: new Date(fetchedAt).toISOString(),
			};
			const maxAge = 60 * 1000; // 1 minute
			expect(isCacheValid(metadata, maxAge)).toBe(false);
		});
	});

	// =============================================================================
	// URL Detection Tests
	// =============================================================================

	describe("isStandaloneUrlParagraph", () => {
		it("should return URL for plain text URL", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [{ type: "text", value: "https://example.com" } as Text],
			};
			expect(isStandaloneUrlParagraph(node)).toBe("https://example.com");
		});

		it("should return URL for http URL", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [{ type: "text", value: "http://example.com" } as Text],
			};
			expect(isStandaloneUrlParagraph(node)).toBe("http://example.com");
		});

		it("should return null for non-URL text", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [{ type: "text", value: "just some text" } as Text],
			};
			expect(isStandaloneUrlParagraph(node)).toBe(null);
		});

		it("should return URL for link node where text equals URL", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [
					{
						type: "link",
						url: "https://example.com",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Link,
				],
			};
			expect(isStandaloneUrlParagraph(node)).toBe("https://example.com");
		});

		it("should return URL for empty link node", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [
					{
						type: "link",
						url: "https://example.com",
						children: [],
					} as Link,
				],
			};
			expect(isStandaloneUrlParagraph(node)).toBe("https://example.com");
		});

		it("should return null for link with custom text", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [
					{
						type: "link",
						url: "https://example.com",
						children: [{ type: "text", value: "Click here" } as Text],
					} as Link,
				],
			};
			expect(isStandaloneUrlParagraph(node)).toBe(null);
		});

		it("should return null for paragraph with multiple children", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [
					{ type: "text", value: "Visit " } as Text,
					{
						type: "link",
						url: "https://example.com",
						children: [{ type: "text", value: "here" } as Text],
					} as Link,
				],
			};
			expect(isStandaloneUrlParagraph(node)).toBe(null);
		});

		it("should trim whitespace from URL text", () => {
			const node: Paragraph = {
				type: "paragraph",
				children: [{ type: "text", value: "  https://example.com  " } as Text],
			};
			expect(isStandaloneUrlParagraph(node)).toBe("https://example.com");
		});
	});

	describe("collectStandaloneUrls", () => {
		it("should collect single standalone URL", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};
			const urls = collectStandaloneUrls(tree);
			expect(urls).toHaveLength(1);
			expect(urls[0].url).toBe("https://example.com");
			expect(urls[0].index).toBe(0);
		});

		it("should collect multiple standalone URLs", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example1.com" } as Text],
					} as Paragraph,
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example2.com" } as Text],
					} as Paragraph,
				],
			};
			const urls = collectStandaloneUrls(tree);
			expect(urls).toHaveLength(2);
			expect(urls[0].url).toBe("https://example1.com");
			expect(urls[1].url).toBe("https://example2.com");
		});

		it("should skip paragraphs without standalone URLs", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "Regular paragraph" } as Text],
					} as Paragraph,
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};
			const urls = collectStandaloneUrls(tree);
			expect(urls).toHaveLength(1);
			expect(urls[0].url).toBe("https://example.com");
			expect(urls[0].index).toBe(1);
		});

		it("should return empty array for tree without URLs", () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "Just text" } as Text],
					} as Paragraph,
				],
			};
			const urls = collectStandaloneUrls(tree);
			expect(urls).toHaveLength(0);
		});
	});

	// =============================================================================
	// HTML Generation Tests
	// =============================================================================

	describe("generateLinkCardHtml", () => {
		const baseMetadata: LinkCardMetadata = {
			url: "https://example.com",
			title: "Example Title",
			description: "Example description",
			image: "https://example.com/image.png",
			siteName: "example.com",
			fetchedAt: new Date().toISOString(),
		};

		it("should generate full HTML with all fields", () => {
			const html = generateLinkCardHtml(baseMetadata, "link-card");
			expect(html).toContain('href="https://example.com"');
			expect(html).toContain('class="link-card"');
			expect(html).toContain('target="_blank"');
			expect(html).toContain('rel="noopener noreferrer"');
			expect(html).toContain("Example Title");
			expect(html).toContain("Example description");
			expect(html).toContain('src="https://example.com/image.png"');
			expect(html).toContain("example.com");
		});

		it("should omit image div when image is empty", () => {
			const metadata = { ...baseMetadata, image: "" };
			const html = generateLinkCardHtml(metadata, "link-card");
			expect(html).not.toContain("link-card__image");
			expect(html).not.toContain("<img");
		});

		it("should omit description when empty", () => {
			const metadata = { ...baseMetadata, description: "" };
			const html = generateLinkCardHtml(metadata, "link-card");
			expect(html).not.toContain("link-card__description");
		});

		it("should escape HTML in title", () => {
			const metadata = { ...baseMetadata, title: '<script>alert("xss")</script>' };
			const html = generateLinkCardHtml(metadata, "link-card");
			expect(html).toContain("&lt;script&gt;");
			expect(html).not.toContain("<script>");
		});

		it("should use custom className", () => {
			const html = generateLinkCardHtml(baseMetadata, "custom-card");
			expect(html).toContain('class="custom-card"');
			expect(html).toContain("custom-card__title");
		});
	});

	describe("generateHeadlessHtml", () => {
		const baseMetadata: LinkCardMetadata = {
			url: "https://example.com",
			title: "Example Title",
			description: "Example description",
			image: "https://example.com/image.png",
			siteName: "example.com",
			fetchedAt: new Date().toISOString(),
		};

		it("should generate anchor with data attributes", () => {
			const html = generateHeadlessHtml(baseMetadata, "link-card");
			expect(html).toContain('href="https://example.com"');
			expect(html).toContain('class="link-card"');
			expect(html).toContain("data-link-card");
			expect(html).toContain('data-title="Example Title"');
			expect(html).toContain('data-description="Example description"');
			expect(html).toContain('data-image="https://example.com/image.png"');
			expect(html).toContain('data-site-name="example.com"');
		});

		it("should escape HTML in data attributes", () => {
			const metadata = { ...baseMetadata, title: 'Test "quoted" title' };
			const html = generateHeadlessHtml(metadata, "link-card");
			expect(html).toContain('data-title="Test &quot;quoted&quot; title"');
		});
	});

	describe("generateMarkerHtml", () => {
		const baseMetadata: LinkCardMetadata = {
			url: "https://example.com",
			title: "Example Title",
			description: "Example description",
			image: "https://example.com/image.png",
			siteName: "example.com",
			fetchedAt: new Date().toISOString(),
		};

		it("should generate custom element with data attributes", () => {
			const html = generateMarkerHtml(baseMetadata, "link-card");
			expect(html).toContain("<link-card");
			expect(html).toContain("</link-card>");
			expect(html).toContain('data-url="https://example.com"');
			expect(html).toContain('data-title="Example Title"');
		});

		it("should use custom tag name", () => {
			const html = generateMarkerHtml(baseMetadata, "my-card-element");
			expect(html).toContain("<my-card-element");
			expect(html).toContain("</my-card-element>");
		});
	});

	describe("generateFallbackLinkHtml", () => {
		it("should generate simple anchor tag", () => {
			const html = generateFallbackLinkHtml("https://example.com");
			expect(html).toBe(
				'<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>'
			);
		});

		it("should escape HTML in URL", () => {
			const html = generateFallbackLinkHtml("https://example.com/path?q=<script>");
			expect(html).toContain("&lt;script&gt;");
		});
	});

	// =============================================================================
	// OGP Fetching Tests (Mocked)
	// =============================================================================

	describe("fetchOGP", () => {
		beforeEach(() => {
			vi.spyOn(global, "fetch");
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should extract OGP metadata from valid response", async () => {
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta property="og:title" content="Test Title">
					<meta property="og:description" content="Test Description">
					<meta property="og:image" content="https://example.com/image.png">
					<meta property="og:site_name" content="Test Site">
				</head>
				</html>
			`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.url).toBe("https://example.com");
			expect(metadata.title).toBe("Test Title");
			expect(metadata.description).toBe("Test Description");
			expect(metadata.image).toBe("https://example.com/image.png");
			expect(metadata.siteName).toBe("Test Site");
		});

		it("should fallback to title tag when og:title is missing", async () => {
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head>
					<title>Fallback Title</title>
				</head>
				</html>
			`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.title).toBe("Fallback Title");
		});

		it("should use URL as title when no title found", async () => {
			const mockHtml = `<!DOCTYPE html><html><head></head></html>`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.title).toBe("https://example.com");
		});

		it("should use hostname as siteName when og:site_name is missing", async () => {
			const mockHtml = `<!DOCTYPE html><html><head><title>Test</title></head></html>`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com/path", 5000);
			expect(metadata.siteName).toBe("example.com");
		});

		it("should convert relative image URL to absolute", async () => {
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta property="og:title" content="Test">
					<meta property="og:image" content="/images/og.png">
				</head>
				</html>
			`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com/page", 5000);
			expect(metadata.image).toBe("https://example.com/images/og.png");
		});

		it("should handle meta tags with content before property", async () => {
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta content="Reversed Order Title" property="og:title">
				</head>
				</html>
			`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.title).toBe("Reversed Order Title");
		});

		it("should return empty metadata on fetch error", async () => {
			vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.url).toBe("https://example.com");
			expect(metadata.title).toBe("");
		});

		it("should return empty metadata on non-ok response", async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				status: 404,
			} as Response);

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.title).toBe("");
		});

		it("should handle name=description meta tag", async () => {
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head>
					<title>Test</title>
					<meta name="description" content="Meta description">
				</head>
				</html>
			`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const metadata = await fetchOGP("https://example.com", 5000);
			expect(metadata.description).toBe("Meta description");
		});
	});

	// =============================================================================
	// Cache Management Tests (Mocked)
	// =============================================================================

	describe("Cache Management", () => {
		beforeEach(() => {
			clearCacheManager();
			vi.spyOn(fs, "existsSync");
			vi.spyOn(fs, "readFileSync");
			vi.spyOn(fs, "writeFileSync");
			vi.spyOn(fs, "mkdirSync");
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		describe("loadCache", () => {
			it("should return empty object when cache file does not exist", () => {
				vi.mocked(fs.existsSync).mockReturnValue(false);

				const cache = loadCache("/path/to/cache.json");
				expect(cache).toEqual({});
			});

			it("should return parsed cache when file exists", () => {
				const mockCache: LinkCardCache = {
					"https://example.com": {
						url: "https://example.com",
						title: "Test",
						description: "",
						image: "",
						siteName: "example.com",
						fetchedAt: new Date().toISOString(),
					},
				};

				vi.mocked(fs.existsSync).mockReturnValue(true);
				vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCache));

				const cache = loadCache("/path/to/cache.json");
				expect(cache).toEqual(mockCache);
			});

			it("should return empty object on JSON parse error", () => {
				vi.mocked(fs.existsSync).mockReturnValue(true);
				vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
				const cache = loadCache("/path/to/cache.json");
				expect(cache).toEqual({});
				consoleSpy.mockRestore();
			});
		});

		describe("saveCache", () => {
			it("should create directory if it does not exist", () => {
				vi.mocked(fs.existsSync).mockReturnValue(false);
				vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
				vi.mocked(fs.writeFileSync).mockImplementation(() => {});

				const cache: LinkCardCache = {};
				saveCache("/path/to/cache.json", cache);

				expect(fs.mkdirSync).toHaveBeenCalledWith("/path/to", { recursive: true });
				expect(fs.writeFileSync).toHaveBeenCalled();
			});

			it("should write JSON to file", () => {
				vi.mocked(fs.existsSync).mockReturnValue(true);
				vi.mocked(fs.writeFileSync).mockImplementation(() => {});

				const cache: LinkCardCache = {
					"https://example.com": {
						url: "https://example.com",
						title: "Test",
						description: "",
						image: "",
						siteName: "example.com",
						fetchedAt: "2024-01-01T00:00:00.000Z",
					},
				};
				saveCache("/path/to/cache.json", cache);

				expect(fs.writeFileSync).toHaveBeenCalledWith(
					"/path/to/cache.json",
					JSON.stringify(cache, null, 2),
					"utf-8"
				);
			});
		});
	});

	// =============================================================================
	// Plugin Integration Tests
	// =============================================================================

	describe("remarkLinkCard Plugin", () => {
		beforeEach(() => {
			clearCacheManager();
			vi.spyOn(global, "fetch");
			vi.spyOn(fs, "existsSync");
			vi.spyOn(fs, "readFileSync");
			vi.spyOn(fs, "writeFileSync");
			vi.spyOn(fs, "mkdirSync");
			vi.spyOn(console, "log").mockImplementation(() => {});
			vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should transform standalone URL to link card HTML", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

			const mockHtml = `
				<html><head>
					<meta property="og:title" content="Test Site">
					<meta property="og:description" content="Test Description">
				</head></html>
			`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({ cachePath: "/tmp/test-cache.json" });
			await plugin(tree);

			expect(tree.children).toHaveLength(1);
			expect(tree.children[0].type).toBe("html");
			const htmlNode = tree.children[0] as { type: "html"; value: string };
			expect(htmlNode.value).toContain("Test Site");
			expect(htmlNode.value).toContain("link-card");
		});

		it("should not transform inline URLs", async () => {
			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [
							{ type: "text", value: "Visit " } as Text,
							{
								type: "link",
								url: "https://example.com",
								children: [{ type: "text", value: "here" } as Text],
							} as Link,
						],
					} as Paragraph,
				],
			};

			vi.mocked(fs.existsSync).mockReturnValue(false);

			const plugin = remarkLinkCard({ cachePath: "/tmp/test-cache.json" });
			await plugin(tree);

			expect(tree.children[0].type).toBe("paragraph");
		});

		it("should use headless mode when enabled", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

			const mockHtml = `<html><head><meta property="og:title" content="Test"></head></html>`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({
				cachePath: "/tmp/test-cache.json",
				headless: true,
			});
			await plugin(tree);

			const htmlNode = tree.children[0] as { type: "html"; value: string };
			expect(htmlNode.value).toContain("data-link-card");
			expect(htmlNode.value).toContain("data-title");
		});

		it("should use marker mode when enabled", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

			const mockHtml = `<html><head><meta property="og:title" content="Test"></head></html>`;
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				text: async () => mockHtml,
			} as Response);

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({
				cachePath: "/tmp/test-cache.json",
				headless: "marker",
				tagName: "custom-link-card",
			});
			await plugin(tree);

			const htmlNode = tree.children[0] as { type: "html"; value: string };
			expect(htmlNode.value).toContain("<custom-link-card");
			expect(htmlNode.value).toContain("</custom-link-card>");
		});

		it("should use cached data when available", async () => {
			const cachedData: LinkCardCache = {
				"https://example.com": {
					url: "https://example.com",
					title: "Cached Title",
					description: "Cached Description",
					image: "",
					siteName: "example.com",
					fetchedAt: new Date().toISOString(),
				},
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({ cachePath: "/tmp/test-cache.json" });
			await plugin(tree);

			// fetch should not be called when cache is valid
			expect(fetch).not.toHaveBeenCalled();

			const htmlNode = tree.children[0] as { type: "html"; value: string };
			expect(htmlNode.value).toContain("Cached Title");
		});

		it("should generate fallback link on fetch failure when fallbackOnError is true", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

			vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({
				cachePath: "/tmp/test-cache.json",
				fallbackOnError: true,
			});
			await plugin(tree);

			const htmlNode = tree.children[0] as { type: "html"; value: string };
			expect(htmlNode.value).toContain('href="https://example.com"');
			expect(htmlNode.value).not.toContain("link-card__title");
		});

		it("should skip transformation when fallbackOnError is false and fetch fails", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

			vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({
				cachePath: "/tmp/test-cache.json",
				fallbackOnError: false,
			});
			await plugin(tree);

			// Original paragraph should remain
			expect(tree.children[0].type).toBe("paragraph");
		});

		it("should handle multiple URLs in sequence", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

			vi.mocked(fetch)
				.mockResolvedValueOnce({
					ok: true,
					text: async () => `<html><head><meta property="og:title" content="Site 1"></head></html>`,
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					text: async () => `<html><head><meta property="og:title" content="Site 2"></head></html>`,
				} as Response);

			const tree: Root = {
				type: "root",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example1.com" } as Text],
					} as Paragraph,
					{
						type: "paragraph",
						children: [{ type: "text", value: "https://example2.com" } as Text],
					} as Paragraph,
				],
			};

			const plugin = remarkLinkCard({ cachePath: "/tmp/test-cache.json" });
			await plugin(tree);

			expect(tree.children).toHaveLength(2);
			expect((tree.children[0] as { value: string }).value).toContain("Site 1");
			expect((tree.children[1] as { value: string }).value).toContain("Site 2");
		});
	});
});
