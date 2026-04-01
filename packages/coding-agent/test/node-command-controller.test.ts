import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("command controller under node", () => {
	it("imports without requiring Bun runtime packages", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const controllerModuleUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "modes", "controllers", "command-controller.ts"),
		).href;
		const script = `
			import { CommandController } from ${JSON.stringify(controllerModuleUrl)};

			console.log(typeof CommandController === "function" ? "command-controller-ok" : "command-controller-missing");
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("command-controller-ok");
	});
});
