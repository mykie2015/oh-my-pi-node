import { describe, expect, it } from "vitest";
import { parseJsonlLenient, readJsonl, readLines, readSseJson } from "../src/stream";

const encoder = new TextEncoder();

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const output: T[] = [];
	for await (const item of iter) output.push(item);
	return output;
}

describe("readLines", () => {
	it("splits lines across chunks without newlines", async () => {
		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode("alpha\nbe"));
				controller.enqueue(encoder.encode("ta\ngam"));
				controller.enqueue(encoder.encode("ma"));
				controller.close();
			},
		});

		const output: string[] = [];
		const dec = new TextDecoder();
		for await (const line of readLines(readable)) {
			output.push(dec.decode(line));
		}

		expect(output).toEqual(["alpha", "beta", "gamma"]);
	});
});

describe("readJsonl", () => {
	it("parses JSONL across chunk boundaries", async () => {
		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('{"a":1}\n{"b":'));
				controller.enqueue(encoder.encode('2}\n{"c":3}\n'));
				controller.close();
			},
		});

		const output = await collectAsync(readJsonl(readable));
		expect(output).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
	});

	it("parses trailing line without newline", async () => {
		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('{"z":9}'));
				controller.close();
			},
		});

		const output = await collectAsync(readJsonl(readable));
		expect(output).toEqual([{ z: 9 }]);
	});
});

describe("parseJsonlLenient", () => {
	it("parses valid JSONL", () => {
		const result = parseJsonlLenient<{ a: number }>('{"a":1}\n{"a":2}\n{"a":3}\n');
		expect(result).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
	});

	it("skips malformed lines and continues", () => {
		const result = parseJsonlLenient<{ a: number }>('{"a":1}\n{bad json}\n{"a":3}\n');
		expect(result).toEqual([{ a: 1 }, { a: 3 }]);
	});

	it("returns empty array for empty input", () => {
		expect(parseJsonlLenient("")).toEqual([]);
	});

	it("handles input without trailing newline", () => {
		const result = parseJsonlLenient<{ x: number }>('{"x":42}');
		expect(result).toEqual([{ x: 42 }]);
	});
});

describe("readSseJson", () => {
	it("parses data lines and stops at [DONE]", async () => {
		const chunks = [
			encoder.encode('data: {"a":1}\n'),
			encoder.encode("event: ping\n"),
			encoder.encode('data: {"b":2}\r\n'),
			encoder.encode("data: [DONE]\n"),
			encoder.encode('data: {"c":3}\n'),
		];
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(chunk);
				controller.close();
			},
		});

		const output = await collectAsync(readSseJson(stream));
		expect(output).toEqual([{ a: 1 }, { b: 2 }]);
	});

	it("parses trailing line without newline", async () => {
		const chunks = [encoder.encode('data: {"c":3}')];
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(chunk);
				controller.close();
			},
		});

		const output = await collectAsync(readSseJson(stream));
		expect(output).toEqual([{ c: 3 }]);
	});

	it("handles data lines split across chunks", async () => {
		const chunks = [encoder.encode('data: {"a"'), encoder.encode(":1}\n")];
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(chunk);
				controller.close();
			},
		});

		const output = await collectAsync(readSseJson(stream));
		expect(output).toEqual([{ a: 1 }]);
	});
});
