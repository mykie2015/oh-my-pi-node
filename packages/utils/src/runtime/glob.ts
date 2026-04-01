import * as path from "node:path";
import fg from "fast-glob";

export interface ScanGlobOptions {
	dot?: boolean;
	onlyFiles?: boolean;
	ignore?: string[];
}

function normalizePaths(entries: readonly string[]): string[] {
	return entries.map(entry => entry.split(path.sep).join("/"));
}

export async function scanGlob(
	patterns: string | readonly string[],
	cwd: string,
	options: ScanGlobOptions = {},
): Promise<string[]> {
	const { dot = false, onlyFiles = false, ignore } = options;
	const entries = await fg(patterns, {
		cwd,
		dot,
		ignore,
		onlyFiles,
		unique: true,
	});
	return normalizePaths(entries);
}

export function scanGlobSync(
	patterns: string | readonly string[],
	cwd: string,
	options: ScanGlobOptions = {},
): string[] {
	const { dot = false, onlyFiles = false, ignore } = options;
	const entries = fg.sync(patterns, {
		cwd,
		dot,
		ignore,
		onlyFiles,
		unique: true,
	});
	return normalizePaths(entries);
}

export function matchesGlob(pattern: string, candidate: string): boolean {
	return path.matchesGlob(candidate, pattern);
}
