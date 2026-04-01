import { rm } from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashText64Base36, loadEnvIntoProcess, moduleDir, readJsonlChunk, sleep, writeTextFileEnsured } from "../src";

describe("node runtime helpers", () => {
	const fixtureDir = path.join(process.cwd(), "packages", "utils", "test", ".tmp-runtime");

	beforeEach(async () => {
		await writeTextFileEnsured(path.join(fixtureDir, ".keep"), "x");
	});

	afterEach(async () => {
		await rm(fixtureDir, { recursive: true, force: true });
		delete process.env.PI_TMP_KEY;
		delete process.env.PI_OTHER_KEY;
	});

	it("returns a stable module directory from import.meta.url", () => {
		expect(moduleDir(import.meta.url)).toContain(path.join("packages", "utils", "test"));
	});

	it("loads .env values into process.env without overwriting existing values", async () => {
		process.env.PI_TMP_KEY = "keep-me";
		await writeTextFileEnsured(path.join(fixtureDir, ".env"), "PI_TMP_KEY=replace-me\nPI_OTHER_KEY=loaded\n");

		loadEnvIntoProcess(path.join(fixtureDir, ".env"));

		expect(process.env.PI_TMP_KEY).toBe("keep-me");
		expect(process.env.PI_OTHER_KEY).toBe("loaded");
	});

	it("parses jsonl chunks across line boundaries", () => {
		const chunk = Buffer.from('{"a":1}\n{"b":2}\n');
		const parsed = readJsonlChunk(chunk);
		expect(parsed.values).toEqual([{ a: 1 }, { b: 2 }]);
	});

	it("produces stable xxhash-like ids", () => {
		expect(hashText64Base36("omp")).toBe(hashText64Base36("omp"));
	});

	it("sleeps without Bun", async () => {
		const start = Date.now();
		await sleep(5);
		expect(Date.now() - start).toBeGreaterThanOrEqual(5);
	});
});
