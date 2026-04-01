import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("sshfs mount under node", () => {
	it("imports without requiring Bun runtime packages", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const sshfsMountModuleUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "ssh", "sshfs-mount.ts"),
		).href;
		const script = `
			import { hasSshfs } from ${JSON.stringify(sshfsMountModuleUrl)};

			console.log(typeof hasSshfs === "function" ? "sshfs-ok" : "sshfs-missing");
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("sshfs-ok");
	});
});
