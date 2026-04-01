import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { $env, logger, spawnProcessSync, whichSync } from "@oh-my-pi/pi-utils";

/**
 * lspmux integration for LSP server multiplexing.
 *
 * When lspmux is available and running, this module wraps supported LSP server
 * commands to use lspmux client mode, enabling server instance sharing across
 * multiple editor windows.
 *
 * Integration is transparent: if lspmux is unavailable, falls back to direct spawning.
 */

// =============================================================================
// Types
// =============================================================================

interface LspmuxConfig {
	instance_timeout?: number;
	gc_interval?: number;
	listen?: [string, number] | string;
	connect?: [string, number] | string;
	log_filters?: string;
	pass_environment?: string[];
}

interface LspmuxState {
	available: boolean;
	running: boolean;
	binaryPath: string | null;
	config: LspmuxConfig | null;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Servers that benefit from lspmux multiplexing.
 *
 * lspmux can multiplex any LSP server, but it's most beneficial for servers
 * with high startup cost or significant memory usage.
 */
const DEFAULT_SUPPORTED_SERVERS = new Set([
	"rust-analyzer",
	// Other servers can be added after testing with lspmux
]);

/** Timeout for liveness check (ms) */
const LIVENESS_TIMEOUT_MS = 1000;

/** Cache duration for lspmux state (5 minutes) */
const STATE_CACHE_TTL_MS = 5 * 60 * 1000;

// =============================================================================
// Config Path
// =============================================================================

/**
 * Get the lspmux config path based on platform.
 * Matches Rust's `dirs::config_dir()` behavior.
 */
function getConfigPath(): string {
	const home = os.homedir();
	switch (os.platform()) {
		case "win32":
			return path.join($env.APPDATA ?? path.join(home, "AppData", "Roaming"), "lspmux", "config.toml");
		case "darwin":
			return path.join(home, "Library", "Application Support", "lspmux", "config.toml");
		default:
			return path.join($env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "lspmux", "config.toml");
	}
}

// =============================================================================
// State Management
// =============================================================================

let cachedState: LspmuxState | null = null;
let cacheTimestamp = 0;

function splitTomlArrayItems(raw: string): string[] {
	const items: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;
	for (let i = 0; i < raw.length; i++) {
		const char = raw[i];
		if (quote) {
			if (char === quote && raw[i - 1] !== "\\") {
				quote = null;
			}
			current += char;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}
		if (char === ",") {
			items.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	if (current.trim().length > 0) {
		items.push(current.trim());
	}
	return items;
}

function parseTomlValue(raw: string): unknown {
	const value = raw.trim();
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	if (value.startsWith("[") && value.endsWith("]")) {
		return splitTomlArrayItems(value.slice(1, -1)).map(item => parseTomlValue(item));
	}
	if (value === "true") return true;
	if (value === "false") return false;
	if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
	return value;
}

function parseLooseToml(content: string): LspmuxConfig {
	const config: Record<string, unknown> = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) {
			continue;
		}
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex === -1) {
			continue;
		}
		const key = trimmed.slice(0, eqIndex).trim();
		const rawValue = trimmed.slice(eqIndex + 1).trim();
		config[key] = parseTomlValue(rawValue);
	}
	return config as LspmuxConfig;
}

/**
 * Parse lspmux config.toml file.
 */
async function parseConfig(): Promise<LspmuxConfig | null> {
	try {
		const content = await fs.readFile(getConfigPath(), "utf8");
		return parseLooseToml(content);
	} catch {
		return null;
	}
}

/**
 * Check if lspmux server is running via `lspmux status`.
 */
async function checkServerRunning(binaryPath: string): Promise<boolean> {
	try {
		const result = spawnProcessSync(binaryPath, ["status"], {
			stdio: "pipe",
			windowsHide: true,
			timeout: LIVENESS_TIMEOUT_MS,
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * Detect lspmux availability and state.
 * Results are cached for STATE_CACHE_TTL_MS.
 *
 * Set PI_DISABLE_LSPMUX=1 to disable.
 */
export async function detectLspmux(): Promise<LspmuxState> {
	const now = Date.now();
	if (cachedState && now - cacheTimestamp < STATE_CACHE_TTL_MS) {
		return cachedState;
	}

	if ($env.PI_DISABLE_LSPMUX === "1") {
		cachedState = { available: false, running: false, binaryPath: null, config: null };
		cacheTimestamp = now;
		return cachedState;
	}

	const binaryPath = whichSync("lspmux") ?? null;
	if (!binaryPath) {
		cachedState = { available: false, running: false, binaryPath: null, config: null };
		cacheTimestamp = now;
		return cachedState;
	}

	const [config, running] = await Promise.all([parseConfig(), checkServerRunning(binaryPath)]);

	cachedState = { available: true, running, binaryPath, config };
	cacheTimestamp = now;

	if (running) {
		logger.debug("lspmux detected and running", { binaryPath });
	}

	return cachedState;
}

// =============================================================================
// Command Wrapping
// =============================================================================

/**
 * Check if a server command is supported by lspmux.
 */
export function isLspmuxSupported(command: string): boolean {
	// Extract base command name (handle full paths)
	const baseName = command.split("/").pop() ?? command;
	return DEFAULT_SUPPORTED_SERVERS.has(baseName);
}

export interface LspmuxWrappedCommand {
	command: string;
	args: string[];
	env?: Record<string, string>;
}

/**
 * Wrap a server command to use lspmux client mode.
 *
 * @param originalCommand - The original LSP server command (e.g., "rust-analyzer")
 * @param originalArgs - Original command arguments
 * @param state - lspmux state from detectLspmux()
 * @returns Wrapped command, args, and env vars; or original if lspmux unavailable
 */
export function wrapWithLspmux(
	originalCommand: string,
	originalArgs: string[] | undefined,
	state: LspmuxState,
): LspmuxWrappedCommand {
	if (!state.available || !state.running || !state.binaryPath) {
		return { command: originalCommand, args: originalArgs ?? [] };
	}

	if (!isLspmuxSupported(originalCommand)) {
		return { command: originalCommand, args: originalArgs ?? [] };
	}

	const baseName = originalCommand.split("/").pop() ?? originalCommand;
	const isDefaultRustAnalyzer = baseName === "rust-analyzer" && originalCommand === "rust-analyzer";
	const hasArgs = originalArgs && originalArgs.length > 0;

	// rust-analyzer from $PATH with no args - lspmux's default, simplest case
	if (isDefaultRustAnalyzer && !hasArgs) {
		return { command: state.binaryPath, args: [] };
	}

	// Use explicit `client` subcommand with LSPMUX_SERVER env var
	// Use `--` to separate lspmux options from server args
	const args = hasArgs ? ["client", "--", ...originalArgs] : ["client"];
	return {
		command: state.binaryPath,
		args,
		env: { LSPMUX_SERVER: originalCommand },
	};
}

/**
 * Get lspmux-wrapped command if available, otherwise return original.
 * This is the main entry point for config.ts integration.
 *
 * @param command - Original LSP server command
 * @param args - Original command arguments
 * @returns Command and args to use (possibly wrapped with lspmux)
 */
export async function getLspmuxCommand(command: string, args?: string[]): Promise<LspmuxWrappedCommand> {
	const state = await detectLspmux();
	return wrapWithLspmux(command, args, state);
}
