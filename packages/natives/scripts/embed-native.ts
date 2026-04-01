#!/usr/bin/env node

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const reset = process.argv.includes("--reset");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, "../src/embedded-addon.ts");
const packageJsonPath = path.join(scriptDir, "../package.json");
const nativeDir = path.join(scriptDir, "../native");

const stubContent = `export type EmbeddedAddonVariant = "modern" | "baseline" | "default";

export interface EmbeddedAddonFile {
	variant: EmbeddedAddonVariant;
	filename: string;
	filePath: string;
}

export interface EmbeddedAddon {
	platformTag: string;
	version: string;
	files: EmbeddedAddonFile[];
}

export const embeddedAddon: EmbeddedAddon | null = null;
`;
if (reset) {
	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await fs.writeFile(outputPath, stubContent, "utf8");
	process.exit(0);
}

interface CandidateAddon {
	variant: "modern" | "baseline" | "default";
	filename: string;
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.stat(filePath);
		return true;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw err;
	}
}
const targetPlatform = process.env.TARGET_PLATFORM || process.platform;
const targetArch = process.env.TARGET_ARCH || process.arch;
const platformTag = `${targetPlatform}-${targetArch}`;
const candidates: CandidateAddon[] =
	targetArch === "x64"
		? [
				{ variant: "modern", filename: `pi_natives.${platformTag}-modern.node` },
				{ variant: "baseline", filename: `pi_natives.${platformTag}-baseline.node` },
			]
		: [{ variant: "default", filename: `pi_natives.${platformTag}.node` }];

const available: CandidateAddon[] = [];
for (const candidate of candidates) {
	const candidatePath = path.join(nativeDir, candidate.filename);
	if (await fileExists(candidatePath)) {
		available.push(candidate);
	}
}

if (available.length === 0) {
	const expected = candidates.map(candidate => `  - ${candidate.filename}`).join("\n");
	throw new Error(`No native addons found for ${platformTag}. Expected one of:\n${expected}`);
}
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { version: string };
const imports = available
	.map(
		(candidate, index) =>
			`import addonPath${index} from ${JSON.stringify(`../native/${candidate.filename}`)} with { type: "file" };`,
	)
	.join("\n");
const files = available
	.map(
		(candidate, index) =>
			`\t{ variant: ${JSON.stringify(candidate.variant)}, filename: ${JSON.stringify(candidate.filename)}, filePath: addonPath${index} },`,
	)
	.join("\n");

const content = `${imports}\n\nexport type EmbeddedAddonVariant = "modern" | "baseline" | "default";\n\nexport interface EmbeddedAddonFile {\n\tvariant: EmbeddedAddonVariant;\n\tfilename: string;\n\tfilePath: string;\n}\n\nexport interface EmbeddedAddon {\n\tplatformTag: string;\n\tversion: string;\n\tfiles: EmbeddedAddonFile[];\n}\n\nexport const embeddedAddon: EmbeddedAddon | null = {\n\tplatformTag: ${JSON.stringify(platformTag)},\n\tversion: ${JSON.stringify(packageJson.version)},\n\tfiles: [\n${files}\n\t],\n};\n`;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, content, "utf8");
