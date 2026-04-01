import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("theme init under node", () => {
	it("initializes without requiring Bun globals", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const themeModuleUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "modes", "theme", "theme.ts"),
		).href;
		const script = `
			import { getCurrentThemeName, initTheme } from ${JSON.stringify(themeModuleUrl)};

			await initTheme(false, undefined, undefined, "dark", "light");
			console.log(getCurrentThemeName() ?? "no-theme");
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("dark");
	});
});
