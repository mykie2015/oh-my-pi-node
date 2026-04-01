#!/usr/bin/env node

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { compile } from "@tailwindcss/node";
import { build } from "esbuild";

/**
 * Extract Tailwind class names from source files by scanning for className attributes.
 */
async function extractTailwindClasses(dir: string): Promise<Set<string>> {
	const classes = new Set<string>();
	const classPattern = /className\s*=\s*["'`]([^"'`]+)["'`]/g;

	async function scanDir(currentDir: string): Promise<void> {
		const entries = await fs.readdir(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				await scanDir(fullPath);
			} else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
				const content = await fs.readFile(fullPath, "utf8");
				const matches = content.matchAll(classPattern);
				for (const match of matches) {
					for (const cls of match[1].split(/\s+/)) {
						if (cls) classes.add(cls);
					}
				}
			}
		}
	}

	await scanDir(dir);
	return classes;
}

// Clean dist
await fs.rm("./dist/client", { recursive: true, force: true });
await fs.mkdir("./dist/client", { recursive: true });

// Build Tailwind CSS
console.log("Building Tailwind CSS...");
const sourceCss = await fs.readFile("./src/client/styles.css", "utf8");
const candidates = await extractTailwindClasses("./src/client");
const baseDir = path.resolve("./src/client");

const compiler = await compile(sourceCss, {
	base: baseDir,
	onDependency: () => {},
});
const tailwindOutput = compiler.build([...candidates]);
await fs.writeFile("./dist/client/styles.css", tailwindOutput, "utf8");

// Build React app
console.log("Building React app...");
await build({
	entryPoints: ["./src/client/index.tsx"],
	outdir: "./dist/client",
	platform: "browser",
	format: "esm",
	bundle: true,
	jsx: "automatic",
	entryNames: "[name]",
	minify: true,
	loader: {
		".css": "empty",
	},
});

// Create index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Usage Statistics</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="root"></div>
    <script src="index.js" type="module"></script>
</body>
</html>`;

await fs.writeFile("./dist/client/index.html", indexHtml, "utf8");

console.log("Build complete");
