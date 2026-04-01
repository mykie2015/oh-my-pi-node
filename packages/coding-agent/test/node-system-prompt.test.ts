import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("system prompt under node", () => {
	it(
		"builds without requiring Bun runtime packages",
		async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const systemPromptModuleUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "system-prompt.ts"),
		).href;
		const script = `
			import { buildSystemPrompt } from ${JSON.stringify(systemPromptModuleUrl)};

			const prompt = await buildSystemPrompt({
				customPrompt: "You are testing Node compatibility.",
				appendSystemPrompt: "",
				skillsSettings: undefined,
			});

			console.log(prompt.includes("Node compatibility") ? "prompt-ok" : "prompt-missing");
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("prompt-ok");
		},
		15_000,
	);
});
