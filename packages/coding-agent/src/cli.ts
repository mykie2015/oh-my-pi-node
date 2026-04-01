#!/usr/bin/env node
import { APP_NAME, VERSION } from "@oh-my-pi/pi-utils";
/**
 * CLI entry point — registers all commands explicitly and delegates to the
 * lightweight CLI runner from pi-utils.
 */
import { type CommandEntry, run } from "@oh-my-pi/pi-utils/cli";

process.title = APP_NAME;

const commands: CommandEntry[] = [
	{ name: "launch", load: () => import("./commands/launch").then(m => m.default) },
	{ name: "agents", load: () => import("./commands/agents").then(m => m.default) },
	{ name: "commit", load: () => import("./commands/commit").then(m => m.default) },
	{ name: "config", load: () => import("./commands/config").then(m => m.default) },
	{ name: "grep", load: () => import("./commands/grep").then(m => m.default) },
	{ name: "jupyter", load: () => import("./commands/jupyter").then(m => m.default) },
	{ name: "plugin", load: () => import("./commands/plugin").then(m => m.default) },
	{ name: "setup", load: () => import("./commands/setup").then(m => m.default) },
	{ name: "shell", load: () => import("./commands/shell").then(m => m.default) },
	{ name: "ssh", load: () => import("./commands/ssh").then(m => m.default) },
	{ name: "stats", load: () => import("./commands/stats").then(m => m.default) },
	{ name: "update", load: () => import("./commands/update").then(m => m.default) },
	{ name: "search", load: () => import("./commands/web-search").then(m => m.default), aliases: ["q"] },
];

async function showHelp(config: import("@oh-my-pi/pi-utils/cli").CliConfig): Promise<void> {
	const { printHelp } = await import("./cli/args");
	void config;
	printHelp();
}

/**
 * Determine whether argv[0] is a known subcommand name.
 * If not, the entire argv is treated as args to the default "launch" command.
 */
function isSubcommand(first: string | undefined): boolean {
	if (!first || first.startsWith("-") || first.startsWith("@")) return false;
	return commands.some(e => e.name === first || e.aliases?.includes(first));
}

/** Run the CLI with the given argv (no `process.argv` prefix). */
export function runCli(argv: string[]): Promise<void> {
	const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
	const first = normalizedArgv[0];

	if (first === "--help" || first === "-h" || first === "help") {
		return import("./cli/args").then(({ printHelp }) => {
			printHelp();
		});
	}

	if (first === "--version" || first === "-v") {
		process.stdout.write(`${VERSION}\n`);
		return Promise.resolve();
	}

	// --help and --version are handled by run() directly, don't rewrite those.
	// Everything else that isn't a known subcommand routes to "launch".
	const runArgv = isSubcommand(first) ? normalizedArgv : ["launch", ...normalizedArgv];
	return run({ bin: APP_NAME, version: VERSION, argv: runArgv, commands, help: showHelp });
}

await runCli(process.argv.slice(2));
