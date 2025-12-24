import { execSync } from "child_process";

/**
 * Git コマンドを実行して日付を取得する共通処理
 */
function getDateFromGit(command: string): Date | null {
	try {
		const result = execSync(command);
		const dateStr = result.toString().trim();
		if (!dateStr) return null;
		return new Date(dateStr);
	} catch {
		return null;
	}
}

/**
 * Git ログからファイルの作成日を取得
 */
export function getFileCreationDate(filePath: string): Date | null {
	return getDateFromGit(`git log --follow --diff-filter=A --pretty="%cs" "${filePath}"`);
}

/**
 * Git ログからファイルの最終更新日を取得
 */
export function getFileLastModifiedDate(filePath: string): Date | null {
	return getDateFromGit(`git log -1 --pretty="%cs" "${filePath}"`);
}
