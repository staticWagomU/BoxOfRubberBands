import { execSync } from "child_process";

/**
 * Git コマンドを実行して ISO 8601 日付文字列を取得
 */
function getDateStringFromGit(command: string): string | null {
	try {
		const result = execSync(command, { encoding: "utf-8" }).trim();
		return result || null;
	} catch {
		return null;
	}
}

/**
 * Git ログからファイルの作成日時を取得 (ISO 8601)
 */
export function getFileCreationDate(filePath: string): string | null {
	return getDateStringFromGit(
		`git log --follow --diff-filter=A --pretty="%cI" "${filePath}"`,
	);
}

/**
 * Git ログからファイルの最終更新日時を取得 (ISO 8601)
 * excludeCommits に含まれるコミットはスキップする
 */
export function getFileLastModifiedDate(
	filePath: string,
	excludeCommits: string[] = [],
): string | null {
	if (excludeCommits.length === 0) {
		return getDateStringFromGit(`git log -1 --pretty="%cI" "${filePath}"`);
	}
	try {
		const result = execSync(`git log --pretty="%H %cI" "${filePath}"`, {
			encoding: "utf-8",
		}).trim();
		if (!result) return null;
		for (const line of result.split("\n")) {
			const spaceIdx = line.indexOf(" ");
			const hash = line.substring(0, spaceIdx);
			const dateStr = line.substring(spaceIdx + 1);
			if (!excludeCommits.some((exc) => hash.startsWith(exc))) {
				return dateStr || null;
			}
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * git diff で前回のキャッシュ以降に変更されたファイルを取得
 * ref が空の場合は全ファイルを返す
 */
export function getChangedFiles(dir: string, ref: string | null): string[] {
	if (!ref) return [];
	try {
		const result = execSync(`git diff --name-only ${ref} HEAD -- "${dir}"`, {
			encoding: "utf-8",
		}).trim();
		return result ? result.split("\n") : [];
	} catch {
		return [];
	}
}

/**
 * 現在の HEAD の commit hash を取得
 */
export function getHeadRef(): string | null {
	try {
		return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
	} catch {
		return null;
	}
}
