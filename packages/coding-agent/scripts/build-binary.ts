#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(scriptDir, "..");
const repoRoot = path.join(packageRoot, "..", "..");
const distDir = path.join(packageRoot, "dist");
const outputPath = path.join(distDir, "omp");
const nativesDir = path.join(repoRoot, "packages", "natives");
const nativeArtifactsDir = path.join(nativesDir, "native");

function runPnpm(args: string[], cwd = repoRoot): void {
	const result = spawnSync(pnpmCommand, args, {
		cwd,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		throw new Error(`Command failed: ${pnpmCommand} ${args.join(" ")}`);
	}
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function shouldEmbedNative(): Promise<boolean> {
	if (!(await pathExists(nativeArtifactsDir))) {
		return false;
	}
	const entries = await fs.readdir(nativeArtifactsDir);
	return entries.some(entry => entry.endsWith(".node"));
}

async function writeLauncher(): Promise<void> {
	await fs.mkdir(distDir, { recursive: true });

	const launcher = `#!/usr/bin/env node
import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const distDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(distDir, "../..");
const loaderPath = path.join(repoRoot, "scripts", "text-loader.mjs");
const cliPath = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");

const child = spawn(
\tprocess.execPath,
\t["--import", "tsx", "--loader", loaderPath, cliPath, ...process.argv.slice(2)],
\t{
\t\tcwd: repoRoot,
\t\tstdio: "inherit",
\t\tenv: process.env,
\t},
);

child.on("error", error => {
\tconsole.error(error);
\tprocess.exit(1);
});

child.on("exit", (code, signal) => {
\tif (signal) {
\t\tprocess.kill(process.pid, signal);
\t\treturn;
\t}
\tprocess.exit(code ?? 0);
});
`;

	await fs.writeFile(outputPath, launcher, "utf8");
	await fs.chmod(outputPath, 0o755);
}

async function main(): Promise<void> {
	const embedNative = await shouldEmbedNative();

	try {
		runPnpm(["--dir", "packages/stats", "exec", "tsx", "scripts/generate-client-bundle.ts"]);
		if (embedNative) {
			runPnpm(["--dir", "packages/natives", "run", "embed:native"]);
		}
		await writeLauncher();
		console.log(`Created ${path.relative(repoRoot, outputPath)}`);
	} finally {
		runPnpm(["--dir", "packages/natives", "run", "embed:native", "--", "--reset"]);
		runPnpm(["--dir", "packages/stats", "exec", "tsx", "scripts/generate-client-bundle.ts", "--reset"]);
	}
}

await main();
