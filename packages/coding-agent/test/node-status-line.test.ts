import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("status line under node", () => {
	it("imports without requiring Bun runtime packages", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const moduleUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "modes", "components", "status-line.ts"),
		).href;
		const script = `
			const module = await import(${JSON.stringify(moduleUrl)});
			console.log(typeof module.StatusLineComponent === "function" ? "status-line-ok" : "status-line-missing");
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("status-line-ok");
	});
});
