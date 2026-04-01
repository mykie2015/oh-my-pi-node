import { createRequire } from "node:module";
import type { DatabaseSync, StatementSync } from "node:sqlite";

const require = createRequire(import.meta.url);

function withSuppressedSqliteExperimentalWarning<T>(fn: () => T): T {
	const originalEmitWarning = process.emitWarning.bind(process);
	process.emitWarning = ((warning: unknown, ...args: unknown[]) => {
		const message =
			typeof warning === "string"
				? warning
				: warning instanceof Error
					? warning.message
					: warning && typeof warning === "object" && "message" in warning
						? String((warning as { message?: unknown }).message ?? "")
						: "";
		if (message.includes("SQLite is an experimental feature")) {
			return;
		}
		return originalEmitWarning(warning as Parameters<typeof process.emitWarning>[0], ...args);
	}) as typeof process.emitWarning;
	try {
		return fn();
	} finally {
		process.emitWarning = originalEmitWarning;
	}
}

const { DatabaseSync } = withSuppressedSqliteExperimentalWarning(
	() => require("node:sqlite") as typeof import("node:sqlite"),
);

function normalizeStatementArgs(args: unknown[]): unknown[] {
	return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
}

export class Statement<TRow = unknown> {
	readonly #stmt: StatementSync;

	constructor(stmt: StatementSync) {
		this.#stmt = stmt;
	}

	run(...args: unknown[]): ReturnType<StatementSync["run"]> {
		return this.#stmt.run(...normalizeStatementArgs(args));
	}

	get(...args: unknown[]): TRow | undefined {
		return this.#stmt.get(...normalizeStatementArgs(args)) as TRow | undefined;
	}

	all(...args: unknown[]): TRow[] {
		return this.#stmt.all(...normalizeStatementArgs(args)) as TRow[];
	}

	iterate(...args: unknown[]): IterableIterator<TRow> {
		return this.#stmt.iterate(...normalizeStatementArgs(args)) as IterableIterator<TRow>;
	}

	columns(): ReturnType<StatementSync["columns"]> {
		return this.#stmt.columns();
	}
}

type TransactionCallback<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult;

export class Database {
	readonly #db: DatabaseSync;
	#transactionDepth = 0;

	constructor(filename: string, _options?: { create?: boolean }) {
		this.#db = withSuppressedSqliteExperimentalWarning(() => new DatabaseSync(filename));
	}

	prepare<TRow = unknown>(sql: string): Statement<TRow> {
		return new Statement<TRow>(this.#db.prepare(sql));
	}

	query<TRow = unknown>(sql: string): Statement<TRow> {
		return this.prepare<TRow>(sql);
	}

	run(sql: string, params?: unknown[] | unknown): { changes: number; lastInsertRowid: number | bigint } {
		if (params === undefined) {
			this.#db.exec(sql);
			return { changes: 0, lastInsertRowid: 0 };
		}
		return this.#db.prepare(sql).run(...normalizeStatementArgs([params]));
	}

	exec(sql: string): void {
		this.#db.exec(sql);
	}

	transaction<TArgs extends unknown[], TResult>(callback: TransactionCallback<TArgs, TResult>): TransactionCallback<TArgs, TResult> {
		return ((...args: TArgs): TResult => {
			const depth = this.#transactionDepth;
			const savepoint = `pi_tx_${depth}`;
			if (depth === 0) {
				this.#db.exec("BEGIN");
			} else {
				this.#db.exec(`SAVEPOINT ${savepoint}`);
			}
			this.#transactionDepth += 1;
			try {
				const result = callback(...args);
				this.#transactionDepth -= 1;
				if (depth === 0) {
					this.#db.exec("COMMIT");
				} else {
					this.#db.exec(`RELEASE SAVEPOINT ${savepoint}`);
				}
				return result;
			} catch (error) {
				this.#transactionDepth -= 1;
				try {
					if (depth === 0) {
						this.#db.exec("ROLLBACK");
					} else {
						this.#db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
						this.#db.exec(`RELEASE SAVEPOINT ${savepoint}`);
					}
				} catch {
					// Ignore rollback failures and surface the original error.
				}
				throw error;
			}
		}) as TransactionCallback<TArgs, TResult>;
	}

	close(): void {
		this.#db.close();
	}
}
