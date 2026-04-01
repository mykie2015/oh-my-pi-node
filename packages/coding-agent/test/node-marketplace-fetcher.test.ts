import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("marketplace fetcher under node", () => {
	it("imports without requiring Bun runtime packages", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const fetcherModuleUrl = pathToFileURL(
			path.join(
				repoRoot,
				"packages",
				"coding-agent",
				"src",
				"extensibility",
				"plugins",
				"marketplace",
				"fetcher.ts",
			),
		).href;
		const script = `
			import { classifySource } from ${JSON.stringify(fetcherModuleUrl)};

			console.log(classifySource("owner/repo"));
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("github");
	});
});
