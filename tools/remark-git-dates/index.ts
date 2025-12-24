import { execSync } from "child_process";
import type { Root } from "mdast";

interface VFile {
	history: string[];
	data: {
		astro: {
			frontmatter: {
				pubDate?: Date;
				updatedDate?: Date;
			};
		};
	};
}

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

/**
 * Remarkプラグイン: Gitのコミットログからファイルの作成日と更新日を取得
 * Astroのfrontmatterにpubdate と updatedDate を追加
 */
export default function remarkGitDates() {
	return function (_tree: Root, file: VFile) {
		const filePath = file.history[0];
		const frontmatter = file.data.astro.frontmatter;

		// pubDate が未設定の場合、Git から作成日を取得
		if (!frontmatter.pubDate) {
			const creationDate = getFileCreationDate(filePath);
			if (creationDate) {
				frontmatter.pubDate = creationDate;
			}
		}

		// updatedDate が未設定の場合、Git から最終更新日を取得
		if (!frontmatter.updatedDate) {
			const lastModifiedDate = getFileLastModifiedDate(filePath);
			if (lastModifiedDate) {
				frontmatter.updatedDate = lastModifiedDate;
			}
		}
	};
}
