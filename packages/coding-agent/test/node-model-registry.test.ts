import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("ModelRegistry under node", () => {
	it("constructs without requiring Bun globals", async () => {
		const repoRoot = path.resolve(process.cwd(), "../..");
		const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
		const modelRegistryUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "config", "model-registry.ts"),
		).href;
		const authStorageUrl = pathToFileURL(
			path.join(repoRoot, "packages", "coding-agent", "src", "session", "auth-storage.ts"),
		).href;
		const script = `
			import * as fs from "node:fs/promises";
			import * as os from "node:os";
			import * as path from "node:path";
			import { ModelRegistry } from ${JSON.stringify(modelRegistryUrl)};
			import { AuthStorage } from ${JSON.stringify(authStorageUrl)};

			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-node-model-registry-"));
			const authStorage = await AuthStorage.create(path.join(tempDir, "auth.db"));

			try {
				new ModelRegistry(authStorage, path.join(tempDir, "models.json"));
				console.log("registry-ok");
			} finally {
				try {
					authStorage.close();
				} catch {}
				await fs.rm(tempDir, { recursive: true, force: true });
			}
		`;

		const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, "--eval", script], {
			reject: false,
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("registry-ok");
	});
});
