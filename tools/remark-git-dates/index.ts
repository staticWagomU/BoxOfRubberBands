import { execSync } from "child_process";

/**
 * Git ログからファイルの作成日を取得
 */
export function getFileCreationDate(filePath: string): Date | null {
	try {
		const result = execSync(`git log --follow --diff-filter=A --pretty="%cs" "${filePath}"`);
		const dateStr = result.toString().trim();
		if (!dateStr) return null;
		return new Date(dateStr);
	} catch {
		return null;
	}
}

/**
 * Git ログからファイルの最終更新日を取得
 */
export function getFileLastModifiedDate(filePath: string): Date | null {
	try {
		const result = execSync(`git log -1 --pretty="%cs" "${filePath}"`);
		const dateStr = result.toString().trim();
		if (!dateStr) return null;
		return new Date(dateStr);
	} catch {
		return null;
	}
}
