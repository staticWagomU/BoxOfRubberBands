import { readFileSync, writeFileSync } from "fs";

export interface GitDateEntry {
	/** Git 初回コミット日時 (ISO 8601) */
	createdDate: string | null;
	/** Git 最終更新日時 (ISO 8601) */
	updatedDate: string | null;
}

export interface GitDatesCache {
	/** キャッシュ生成時の HEAD commit hash */
	ref: string | null;
	/** ファイルパス → 日付情報 */
	entries: Record<string, GitDateEntry>;
}

const EMPTY_CACHE: GitDatesCache = { ref: null, entries: {} };

export function loadCache(cachePath: string): GitDatesCache {
	try {
		const raw = readFileSync(cachePath, "utf-8");
		return JSON.parse(raw) as GitDatesCache;
	} catch {
		return { ...EMPTY_CACHE, entries: {} };
	}
}

export function saveCache(cachePath: string, cache: GitDatesCache): void {
	writeFileSync(cachePath, JSON.stringify(cache, null, "\t") + "\n");
}
