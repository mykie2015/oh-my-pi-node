import * as path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("node cli smoke", () => {
	it("prints root help under node + tsx", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const cliPath = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, cliPath, "--help"], {
			reject: false,
			env: { ...process.env, NO_COLOR: "1" },
			cwd: repoRoot,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("AI coding assistant");
	});

	it("prints root help when argv includes a pnpm-style leading --", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const cliPath = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, cliPath, "--", "--help"], {
			reject: false,
			env: { ...process.env, NO_COLOR: "1" },
			cwd: repoRoot,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("AI coding assistant");
	});

	it("prints launch help under node + tsx", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const cliPath = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, cliPath, "launch", "--help"], {
			reject: false,
			env: { ...process.env, NO_COLOR: "1" },
			cwd: repoRoot,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Output mode: text (default), json, or rpc");
	});
});
