import { resolve } from "path";
import { writeFileSync } from "fs";
import { loadCache, saveCache } from "./cache.ts";
import { resolveGitDates } from "./resolve.ts";

const CONTENT_DIR = "./src/content/blog";
const CACHE_PATH = ".git-dates-cache.json";
const OUTPUT_PATH = "./generated/git-dates.ts";
const EXTENSIONS = [".mdx", ".md"];
const EXCLUDE_COMMITS = [
	"07cf7f5", // pubDateのdatetime一括変換 (機械的変更のため除外)
];

const absCachePath = resolve(CACHE_PATH);
const cache = loadCache(absCachePath);
const resolved = resolveGitDates(cache, {
	contentDir: CONTENT_DIR,
	extensions: EXTENSIONS,
	excludeCommits: EXCLUDE_COMMITS,
});
saveCache(absCachePath, resolved);

// ファイルパスから記事IDへ変換
const datesByPostId: Record<string, { createdDate: string | null; updatedDate: string | null }> = {};
for (const [filePath, entry] of Object.entries(resolved.entries)) {
	const id = filePath
		.replace(/^.*\//, "") // ディレクトリ部分を除去
		.replace(/\.[^.]+$/, ""); // 拡張子を除去
	datesByPostId[id] = entry;
}

const code = [
	"// このファイルは tools/git-dates/generate.ts により自動生成されます",
	"// 手動で編集しないでください",
	"",
	"export type GitDateEntry = { createdDate: string | null; updatedDate: string | null };",
	"",
	`const gitDates: Record<string, GitDateEntry> = ${JSON.stringify(datesByPostId, null, "\t")};`,
	"",
	"export default gitDates;",
	"",
].join("\n");

writeFileSync(resolve(OUTPUT_PATH), code);
console.log(`Generated ${OUTPUT_PATH} (${Object.keys(datesByPostId).length} entries)`);
