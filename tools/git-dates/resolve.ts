import { readdirSync } from "fs";
import { join, resolve } from "path";
import type { GitDateEntry, GitDatesCache } from "./cache.ts";
import { getChangedFiles, getFileCreationDate, getFileLastModifiedDate, getHeadRef } from "./git.ts";

export interface ResolveOptions {
	/** ブログ記事ディレクトリ (相対パス) */
	contentDir: string;
	/** 対象の glob パターン (拡張子) */
	extensions: string[];
	/** updatedDate の算出時にスキップするコミットハッシュ */
	excludeCommits: string[];
}

/**
 * キャッシュを起点に、変更があったファイルだけ git を叩いて日付を更新する
 */
export function resolveGitDates(
	cache: GitDatesCache,
	options: ResolveOptions,
): GitDatesCache {
	const { contentDir, extensions, excludeCommits } = options;
	const absDir = resolve(contentDir);
	const headRef = getHeadRef();

	// ディレクトリ内の対象ファイル一覧
	const allFiles = readdirSync(absDir)
		.filter((f) => extensions.some((ext) => f.endsWith(ext)))
		.map((f) => join(contentDir, f));

	// キャッシュの ref から HEAD までの差分ファイルを取得
	const changedFiles = new Set(getChangedFiles(contentDir, cache.ref));

	// キャッシュに存在しないファイル（新規追加）も対象に含める
	const cachedPaths = new Set(Object.keys(cache.entries));
	const newFiles = allFiles.filter((f) => !cachedPaths.has(f));

	// 更新が必要なファイル = diff で検出 + 新規
	const filesToUpdate = new Set([
		...allFiles.filter((f) => changedFiles.has(f)),
		...newFiles,
	]);

	// キャッシュをコピーして更新
	const newEntries: Record<string, GitDateEntry> = {};

	for (const filePath of allFiles) {
		if (filesToUpdate.has(filePath)) {
			// git から取得
			newEntries[filePath] = {
				createdDate: getFileCreationDate(filePath),
				updatedDate: getFileLastModifiedDate(filePath, excludeCommits),
			};
		} else if (cache.entries[filePath]) {
			// キャッシュから引き継ぎ
			newEntries[filePath] = cache.entries[filePath];
		} else {
			// フォールバック: git から取得
			newEntries[filePath] = {
				createdDate: getFileCreationDate(filePath),
				updatedDate: getFileLastModifiedDate(filePath, excludeCommits),
			};
		}
	}

	return { ref: headRef, entries: newEntries };
}
