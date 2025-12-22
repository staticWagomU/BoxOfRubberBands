import { execSync } from "child_process";
import type { Root } from "mdast";

interface VFile {
	history: string[];
	data: {
		astro: {
			frontmatter: {
				updatedDate?: Date;
			};
		};
	};
}

/**
 * Remarkプラグイン: GitのコミットログからファイルのUpdatedDateを取得
 * AstroのfrontmatterにupdatedDateを追加
 */
export default function remarkAstroLastModifiedAt() {
	return function (_tree: Root, file: VFile) {
		const filePath = file.history[0];
		const result = execSync(`git log -1 --pretty="%cs" "${filePath}"`);
		file.data.astro.frontmatter.updatedDate = new Date(result.toString().trim());
	};
}
