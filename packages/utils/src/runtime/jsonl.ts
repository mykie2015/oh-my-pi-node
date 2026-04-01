type JsonlChunkResult = {
	values: unknown[];
	error: unknown;
	read: number;
	done: boolean;
};

function parseTrailingText(text: string): { values: unknown[]; done: boolean } {
	const trimmed = text.trim();
	if (!trimmed) {
		return { values: [], done: true };
	}
	try {
		return { values: [JSON.parse(trimmed)], done: true };
	} catch {
		return { values: [], done: false };
	}
}

export function readJsonlChunk(input: string): JsonlChunkResult;
export function readJsonlChunk(input: Uint8Array, start?: number, stop?: number): JsonlChunkResult;
export function readJsonlChunk(input: Uint8Array | string, start = 0, stop?: number): JsonlChunkResult {
	if (typeof input === "string") {
		let cursor = 0;
		const values: unknown[] = [];

		while (cursor < input.length) {
			const newlineIndex = input.indexOf("\n", cursor);
			if (newlineIndex === -1) {
				const trailing = parseTrailingText(input.slice(cursor));
				return {
					values: [...values, ...trailing.values],
					error: undefined,
					read: trailing.done ? input.length : cursor,
					done: trailing.done,
				};
			}

			const line = input.slice(cursor, newlineIndex).replace(/\r$/, "");
			const trimmed = line.trim();
			if (trimmed) {
				try {
					values.push(JSON.parse(trimmed));
				} catch (error) {
					return { values, error, read: cursor, done: false };
				}
			}
			cursor = newlineIndex + 1;
		}

		return { values, error: undefined, read: cursor, done: true };
	}

	const end = stop ?? input.length;
	let cursor = start;
	const values: unknown[] = [];

	while (cursor < end) {
		const newlineIndex = input.indexOf(0x0a, cursor);
		if (newlineIndex === -1 || newlineIndex >= end) {
			const trailing = Buffer.from(input.subarray(cursor, end)).toString("utf8");
			const parsed = parseTrailingText(trailing);
			return {
				values: [...values, ...parsed.values],
				error: undefined,
				read: parsed.done ? end : cursor,
				done: parsed.done,
			};
		}

		const lineEnd = newlineIndex > cursor && input[newlineIndex - 1] === 0x0d ? newlineIndex - 1 : newlineIndex;
		const line = Buffer.from(input.subarray(cursor, lineEnd)).toString("utf8").trim();
		if (line) {
			try {
				values.push(JSON.parse(line));
			} catch (error) {
				return { values, error, read: cursor, done: false };
			}
		}
		cursor = newlineIndex + 1;
	}

	return { values, error: undefined, read: cursor, done: true };
}
