import {
	type ChildProcess,
	type SpawnOptions,
	type SpawnSyncOptions,
	type SpawnSyncReturns,
	spawn,
	spawnSync,
} from "node:child_process";
import which from "which";

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function whichSync(name: string): string | undefined {
	try {
		return which.sync(name);
	} catch {
		return undefined;
	}
}

export function spawnProcess(command: string, args: readonly string[], options: SpawnOptions = {}): ChildProcess {
	return spawn(command, [...args], options);
}

export function spawnProcessSync(
	command: string,
	args: readonly string[],
	options: SpawnSyncOptions = {},
): SpawnSyncReturns<Buffer> {
	return spawnSync(command, [...args], options);
}
