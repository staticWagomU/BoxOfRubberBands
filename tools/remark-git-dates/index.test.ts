import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "child_process";
import type { Root } from "mdast";

vi.mock("child_process", () => ({
	execSync: vi.fn(),
}));

import { getFileCreationDate, getFileLastModifiedDate } from "./index.ts";
import remarkGitDates from "./index.ts";

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

describe("remark-git-dates", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getFileCreationDate", () => {
		it("should return creation date from git log", () => {
			vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("2023-01-21\n"));

			const result = getFileCreationDate("/path/to/file.mdx");

			expect(result).toEqual(new Date("2023-01-21"));
			expect(childProcess.execSync).toHaveBeenCalledWith(
				expect.stringContaining("git log --follow --diff-filter=A"),
			);
		});
	});

	describe("getFileLastModifiedDate", () => {
		it("should return last modified date from git log", () => {
			vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("2024-02-21\n"));

			const result = getFileLastModifiedDate("/path/to/file.mdx");

			expect(result).toEqual(new Date("2024-02-21"));
			expect(childProcess.execSync).toHaveBeenCalledWith(
				expect.stringContaining("git log -1 --pretty"),
			);
		});
	});

	describe("remarkGitDates plugin", () => {
		it("should set pubDate from git when not present in frontmatter", () => {
			vi.mocked(childProcess.execSync)
				.mockReturnValueOnce(Buffer.from("2023-01-21\n")) // creation date
				.mockReturnValueOnce(Buffer.from("2024-02-21\n")); // last modified

			const file: VFile = {
				history: ["/path/to/file.mdx"],
				data: {
					astro: {
						frontmatter: {},
					},
				},
			};

			const transform = remarkGitDates();
			transform({} as Root, file);

			expect(file.data.astro.frontmatter.pubDate).toEqual(new Date("2023-01-21"));
		});
	});
});
