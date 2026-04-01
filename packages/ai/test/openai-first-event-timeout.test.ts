import { afterEach, describe, expect, it, vi } from "vitest";
import { getOpenAIFirstEventTimeoutMs, getStreamFirstEventTimeoutMs } from "../src/utils/idle-iterator";

describe("openai first-event timeout selection", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("uses the full idle timeout for ollama by default", () => {
		vi.stubEnv("PI_STREAM_FIRST_EVENT_TIMEOUT_MS", undefined);

		expect(
			getOpenAIFirstEventTimeoutMs({
				idleTimeoutMs: 45_000,
				provider: "ollama",
				baseUrl: "http://127.0.0.1:11434/v1",
			}),
		).toBe(45_000);
	});

	it("uses the full idle timeout for local openai-compatible endpoints by default", () => {
		vi.stubEnv("PI_STREAM_FIRST_EVENT_TIMEOUT_MS", undefined);

		expect(
			getOpenAIFirstEventTimeoutMs({
				idleTimeoutMs: 45_000,
				provider: "openai",
				baseUrl: "http://192.168.1.10:8000/v1",
			}),
		).toBe(45_000);
	});

	it("keeps the shorter default timeout for remote providers", () => {
		vi.stubEnv("PI_STREAM_FIRST_EVENT_TIMEOUT_MS", undefined);

		expect(
			getOpenAIFirstEventTimeoutMs({
				idleTimeoutMs: 45_000,
				provider: "openai",
				baseUrl: "https://api.openai.com/v1",
			}),
		).toBe(getStreamFirstEventTimeoutMs(45_000));
	});

	it("respects an explicit timeout override even for local providers", () => {
		vi.stubEnv("PI_STREAM_FIRST_EVENT_TIMEOUT_MS", "5000");

		expect(
			getOpenAIFirstEventTimeoutMs({
				idleTimeoutMs: 45_000,
				provider: "ollama",
				baseUrl: "http://127.0.0.1:11434/v1",
			}),
		).toBe(5_000);
	});
});
