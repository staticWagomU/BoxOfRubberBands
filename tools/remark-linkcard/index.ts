import { visit } from "unist-util-visit";
import type { Root, Paragraph, Link, Text, Html } from "mdast";
import fs from "node:fs";
import path from "node:path";

// =============================================================================
// Types
// =============================================================================

export interface LinkCardMetadata {
	url: string;
	title: string;
	description: string;
	image: string;
	siteName: string;
	fetchedAt: string;
}

export interface LinkCardCache {
	[url: string]: LinkCardMetadata;
}

export interface RemarkLinkCardOptions {
	/**
	 * キャッシュJSONファイルの出力先パス
	 * @default "./src/cache/link-cards.json"
	 */
	cachePath?: string;

	/**
	 * キャッシュの有効期限（ミリ秒）
	 * @default 604800000 (7日)
	 */
	cacheMaxAge?: number;

	/**
	 * フェッチのタイムアウト（ミリ秒）
	 * @default 5000
	 */
	fetchTimeout?: number;

	/**
	 * リンクカードのHTMLクラス名
	 * @default "link-card"
	 */
	className?: string;

	/**
	 * フェッチ失敗時に通常リンクとして表示するか
	 * @default true
	 */
	fallbackOnError?: boolean;

	/**
	 * Headless UIモード
	 * - false: 完全なHTML構造を出力（デフォルト）
	 * - true: data属性のみを持つシンプルな要素を出力
	 * - "marker": カスタム要素マーカーのみを出力（Astroコンポーネントでの置換用）
	 * @default false
	 */
	headless?: boolean | "marker";

	/**
	 * Headlessモード時のカスタム要素タグ名
	 * headless: "marker" の場合に使用
	 * @default "link-card"
	 */
	tagName?: string;
}

// =============================================================================
// Cache Management (with concurrency safety)
// =============================================================================

/**
 * グローバルキャッシュマネージャー
 * - 同一プロセス内でキャッシュをメモリ共有
 * - 保存時にファイルから最新を読み込んでマージ（他プロセスとの競合対策）
 */
class CacheManager {
	private memoryCache: Map<string, LinkCardCache> = new Map();
	private pendingWrites: Map<string, Promise<void>> = new Map();

	/**
	 * キャッシュを読み込む
	 * メモリキャッシュがあればそれを返し、なければファイルから読み込む
	 */
	load(cachePath: string): LinkCardCache {
		// メモリキャッシュがあればそれを使用
		if (this.memoryCache.has(cachePath)) {
			return this.memoryCache.get(cachePath)!;
		}

		// ファイルから読み込んでメモリキャッシュに保存
		const cache = this.loadFromFile(cachePath);
		this.memoryCache.set(cachePath, cache);
		return cache;
	}

	/**
	 * ファイルから直接キャッシュを読み込む
	 */
	private loadFromFile(cachePath: string): LinkCardCache {
		try {
			if (fs.existsSync(cachePath)) {
				const content = fs.readFileSync(cachePath, "utf-8");
				return JSON.parse(content);
			}
		} catch (error) {
			console.warn(`[remark-link-card] Failed to load cache: ${error}`);
		}
		return {};
	}

	/**
	 * キャッシュを保存（マージ方式）
	 * - 保存前にファイルから最新のキャッシュを読み込む
	 * - 新しいエントリをマージしてから保存
	 * - 直列化して同時書き込みを防ぐ
	 */
	async save(cachePath: string, newEntries: LinkCardCache): Promise<void> {
		// 前の書き込みが完了するまで待機
		const pending = this.pendingWrites.get(cachePath);
		if (pending) {
			await pending;
		}

		const writePromise = this.doSave(cachePath, newEntries);
		this.pendingWrites.set(cachePath, writePromise);

		try {
			await writePromise;
		} finally {
			this.pendingWrites.delete(cachePath);
		}
	}

	private async doSave(cachePath: string, newEntries: LinkCardCache): Promise<void> {
		try {
			const dir = path.dirname(cachePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// ファイルから最新のキャッシュを読み込んでマージ
			const existingCache = this.loadFromFile(cachePath);
			const mergedCache = { ...existingCache, ...newEntries };

			// メモリキャッシュも更新
			this.memoryCache.set(cachePath, mergedCache);

			fs.writeFileSync(cachePath, JSON.stringify(mergedCache, null, 2), "utf-8");
		} catch (error) {
			console.warn(`[remark-link-card] Failed to save cache: ${error}`);
		}
	}

	/**
	 * メモリキャッシュにエントリを追加
	 */
	addToMemory(cachePath: string, entries: LinkCardCache): void {
		const current = this.memoryCache.get(cachePath) || {};
		this.memoryCache.set(cachePath, { ...current, ...entries });
	}

	/**
	 * テスト用: メモリキャッシュをクリアする
	 */
	clearMemoryCache(): void {
		this.memoryCache.clear();
		this.pendingWrites.clear();
	}
}

// シングルトンインスタンス
const cacheManager = new CacheManager();

/**
 * テスト用: キャッシュマネージャーのメモリキャッシュをクリアする
 */
export function clearCacheManager(): void {
	cacheManager.clearMemoryCache();
}

export function loadCache(cachePath: string): LinkCardCache {
	return cacheManager.load(cachePath);
}

export function saveCache(cachePath: string, cache: LinkCardCache): void {
	// 同期APIとの互換性のため、非同期保存をトリガー
	cacheManager.save(cachePath, cache).catch((error) => {
		console.warn(`[remark-link-card] Failed to save cache: ${error}`);
	});
}

/**
 * 新しいエントリのみを保存（マージ方式、推奨）
 */
export async function saveCacheAsync(cachePath: string, newEntries: LinkCardCache): Promise<void> {
	await cacheManager.save(cachePath, newEntries);
}

export function isCacheValid(metadata: LinkCardMetadata, maxAge: number): boolean {
	const fetchedAt = new Date(metadata.fetchedAt).getTime();
	const now = Date.now();
	return now - fetchedAt < maxAge;
}

// =============================================================================
// OGP Fetching
// =============================================================================

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; RemarkLinkCard/1.0; +https://github.com)",
				Accept: "text/html,application/xhtml+xml",
			},
		});
		return response;
	} finally {
		clearTimeout(timeoutId);
	}
}

export function extractMetaContent(html: string, patterns: RegExp[]): string {
	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match?.[1]) {
			return decodeHtmlEntities(match[1].trim());
		}
	}
	return "";
}

export function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

export async function fetchOGP(url: string, timeout: number): Promise<LinkCardMetadata> {
	const metadata: LinkCardMetadata = {
		url,
		title: "",
		description: "",
		image: "",
		siteName: "",
		fetchedAt: new Date().toISOString(),
	};

	try {
		const response = await fetchWithTimeout(url, timeout);

		if (!response.ok) {
			console.warn(`[remark-link-card] Failed to fetch ${url}: ${response.status}`);
			return metadata;
		}

		const html = await response.text();

		// OGP Title
		metadata.title = extractMetaContent(html, [
			/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
			/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
			/<title[^>]*>([^<]+)<\/title>/i,
		]);

		// OGP Description
		metadata.description = extractMetaContent(html, [
			/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
			/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i,
			/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
			/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
		]);

		// OGP Image
		metadata.image = extractMetaContent(html, [
			/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
			/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
		]);

		// 相対URLを絶対URLに変換
		if (metadata.image && !metadata.image.startsWith("http")) {
			const urlObj = new URL(url);
			metadata.image = new URL(metadata.image, urlObj.origin).href;
		}

		// Site Name
		metadata.siteName = extractMetaContent(html, [
			/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
			/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i,
		]);

		// site_nameがない場合はドメイン名を使用
		if (!metadata.siteName) {
			metadata.siteName = new URL(url).hostname;
		}

		// titleがない場合はURLを使用
		if (!metadata.title) {
			metadata.title = url;
		}
	} catch (error) {
		console.warn(`[remark-link-card] Error fetching ${url}: ${error}`);
	}

	return metadata;
}

// =============================================================================
// URL Detection
// =============================================================================

const URL_REGEX = /^https?:\/\/[^\s]+$/;

interface StandaloneUrl {
	url: string;
	node: Paragraph;
	index: number;
	parent: Root;
}

export function isStandaloneUrlParagraph(node: Paragraph): string | null {
	// 段落が単一の子要素のみを持つ場合
	if (node.children.length !== 1) {
		return null;
	}

	const child = node.children[0];

	// Case 1: 生のテキストとしてのURL
	if (child.type === "text") {
		const text = child.value.trim();
		if (URL_REGEX.test(text)) {
			return text;
		}
	}

	// Case 2: リンクノード（テキストがURLと同じ、または自動リンク）
	if (child.type === "link") {
		const link = child as Link;

		// 子要素がない、または単一のテキストノード
		if (link.children.length === 0) {
			return link.url;
		}

		if (link.children.length === 1 && link.children[0].type === "text") {
			const linkText = (link.children[0] as Text).value.trim();
			// リンクテキストがURLそのものと同じ場合のみ対象
			if (linkText === link.url || URL_REGEX.test(linkText)) {
				return link.url;
			}
		}
	}

	return null;
}

export function collectStandaloneUrls(tree: Root): StandaloneUrl[] {
	const urls: StandaloneUrl[] = [];

	visit(tree, "paragraph", (node: Paragraph, index, parent) => {
		if (index === undefined || parent === undefined) return;

		const url = isStandaloneUrlParagraph(node);
		if (url) {
			urls.push({
				url,
				node,
				index,
				parent: parent as Root,
			});
		}
	});

	return urls;
}

// =============================================================================
// HTML Generation
// =============================================================================

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function generateLinkCardHtml(metadata: LinkCardMetadata, className: string): string {
	const { url, title, description, image, siteName } = metadata;

	const imageHtml = image
		? `<div class="${className}__image"><img src="${escapeHtml(image)}" alt="" loading="lazy" /></div>`
		: "";

	return `<a href="${escapeHtml(url)}" class="${className}" target="_blank" rel="noopener noreferrer">
  ${imageHtml}
  <div class="${className}__content">
    <div class="${className}__title">${escapeHtml(title)}</div>
    ${description ? `<div class="${className}__description">${escapeHtml(description)}</div>` : ""}
    <div class="${className}__meta">
      <span class="${className}__site">${escapeHtml(siteName)}</span>
    </div>
  </div>
</a>`;
}

/**
 * Headlessモード: data属性のみを持つシンプルな要素を出力
 * CSSやJSで自由にスタイリング可能
 */
export function generateHeadlessHtml(metadata: LinkCardMetadata, className: string): string {
	const { url, title, description, image, siteName } = metadata;

	return `<a href="${escapeHtml(url)}" class="${className}" target="_blank" rel="noopener noreferrer" data-link-card data-title="${escapeHtml(title)}" data-description="${escapeHtml(description)}" data-image="${escapeHtml(image)}" data-site-name="${escapeHtml(siteName)}"></a>`;
}

/**
 * Markerモード: カスタム要素として出力
 * Astroコンポーネントやrehypeプラグインでの置換用
 */
export function generateMarkerHtml(metadata: LinkCardMetadata, tagName: string): string {
	const { url, title, description, image, siteName } = metadata;

	return `<${tagName} data-url="${escapeHtml(url)}" data-title="${escapeHtml(title)}" data-description="${escapeHtml(description)}" data-image="${escapeHtml(image)}" data-site-name="${escapeHtml(siteName)}"></${tagName}>`;
}

export function generateFallbackLinkHtml(url: string): string {
	return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
}

// =============================================================================
// Remark Plugin
// =============================================================================

const DEFAULT_OPTIONS: Required<RemarkLinkCardOptions> = {
	cachePath: "./src/cache/link-cards.json",
	cacheMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
	fetchTimeout: 5000,
	className: "link-card",
	fallbackOnError: true,
	headless: false,
	tagName: "link-card",
};

export function remarkLinkCard(options: RemarkLinkCardOptions = {}) {
	const opts: Required<RemarkLinkCardOptions> = {
		...DEFAULT_OPTIONS,
		...options,
	};

	return async (tree: Root) => {
		// 1. キャッシュを読み込む（メモリキャッシュ or ファイル）
		const cache = loadCache(opts.cachePath);

		// 2. 独立したURLを収集
		const standaloneUrls = collectStandaloneUrls(tree);

		if (standaloneUrls.length === 0) {
			return;
		}

		// 3. キャッシュにない、または期限切れのURLをフェッチ
		const urlsToFetch = standaloneUrls
			.map((item) => item.url)
			.filter((url) => {
				const cached = cache[url];
				if (!cached) return true;
				return !isCacheValid(cached, opts.cacheMaxAge);
			});

		// 新しくフェッチしたエントリを保持
		const newEntries: LinkCardCache = {};

		// 並列でフェッチ
		if (urlsToFetch.length > 0) {
			console.log(`[remark-link-card] Fetching ${urlsToFetch.length} URL(s)...`);

			const results = await Promise.all(urlsToFetch.map((url) => fetchOGP(url, opts.fetchTimeout)));

			for (const metadata of results) {
				cache[metadata.url] = metadata;
				newEntries[metadata.url] = metadata;
			}
		}

		// 4. キャッシュを保存（新しいエントリのみをマージ方式で保存）
		if (Object.keys(newEntries).length > 0) {
			await saveCacheAsync(opts.cachePath, newEntries);
			console.log(`[remark-link-card] Cache saved to ${opts.cachePath}`);
		}

		// 5. ASTを変換
		// 逆順で処理してインデックスのずれを防ぐ
		for (let i = standaloneUrls.length - 1; i >= 0; i--) {
			const { url, index, parent } = standaloneUrls[i];
			const metadata = cache[url];

			let html: string;

			if (metadata && metadata.title) {
				// headlessモードに応じてHTML生成を分岐
				if (opts.headless === "marker") {
					html = generateMarkerHtml(metadata, opts.tagName);
				} else if (opts.headless === true) {
					html = generateHeadlessHtml(metadata, opts.className);
				} else {
					html = generateLinkCardHtml(metadata, opts.className);
				}
			} else if (opts.fallbackOnError) {
				html = generateFallbackLinkHtml(url);
			} else {
				continue;
			}

			const htmlNode: Html = {
				type: "html",
				value: html,
			};

			parent.children.splice(index, 1, htmlNode);
		}
	};
}

export default remarkLinkCard;
