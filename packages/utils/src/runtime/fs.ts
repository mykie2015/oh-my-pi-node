import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function writeTextFileEnsured(filePath: string, content: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, content, "utf8");
}

export async function writeFileEnsured(filePath: string, content: string | Uint8Array): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, content);
}

export async function readTextFile(filePath: string): Promise<string> {
	return fs.readFile(filePath, "utf8");
}

export async function readFileBytes(filePath: string): Promise<Uint8Array> {
	const content = await fs.readFile(filePath);
	return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}
