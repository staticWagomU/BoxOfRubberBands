import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "child_process";

vi.mock("child_process", () => ({
	execSync: vi.fn(),
}));

import { getFileCreationDate } from "./index.ts";

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
});
