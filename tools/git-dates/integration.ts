import { resolve } from "path";
import type { AstroIntegration } from "astro";
import { loadCache, saveCache } from "./cache.ts";
import { resolveGitDates } from "./resolve.ts";

const VIRTUAL_MODULE_ID = "virtual:git-dates";
const RESOLVED_ID = "\0" + VIRTUAL_MODULE_ID;

export interface GitDatesIntegrationOptions {
	/** ブログ記事ディレクトリ (プロジェクトルートからの相対パス) */
	contentDir?: string;
	/** キャッシュファイルのパス */
	cachePath?: string;
	/** 対象ファイルの拡張子 */
	extensions?: string[];
	/** updatedDate の算出時にスキップするコミットハッシュ (前方一致) */
	excludeCommits?: string[];
}

export default function gitDatesIntegration(
	options: GitDatesIntegrationOptions = {},
): AstroIntegration {
	const {
		contentDir = "./src/content/blog",
		cachePath = ".git-dates-cache.json",
		extensions = [".mdx", ".md"],
		excludeCommits = [],
	} = options;

	return {
		name: "astro-git-dates",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				const absCachePath = resolve(cachePath);

				// キャッシュを読み込み → 差分だけ git を叩く → キャッシュ更新
				const cache = loadCache(absCachePath);
				const resolved = resolveGitDates(cache, { contentDir, extensions, excludeCommits });
				saveCache(absCachePath, resolved);

				// ファイルパスから記事IDへ変換したマップを生成
				// "src/content/blog/2026-04-17_1.mdx" → "2026-04-17_1"
				const datesByPostId: Record<string, { createdDate: string | null; updatedDate: string | null }> = {};
				for (const [filePath, entry] of Object.entries(resolved.entries)) {
					const id = filePath
						.replace(/^.*\//, "")  // ディレクトリ部分を除去
						.replace(/\.[^.]+$/, ""); // 拡張子を除去
					datesByPostId[id] = entry;
				}

				const moduleCode = `export default ${JSON.stringify(datesByPostId)};`;

				updateConfig({
					vite: {
						plugins: [
							{
								name: "vite-plugin-git-dates",
								resolveId(id) {
									if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID;
								},
								load(id) {
									if (id === RESOLVED_ID) return moduleCode;
								},
							},
						],
					},
				});
			},
		},
	};
}
