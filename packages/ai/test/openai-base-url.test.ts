import { afterEach, describe, expect, it, vi } from "vitest";
import { getBundledModel } from "../src/models";
import { openaiModelManagerOptions } from "../src/provider-models/openai-compat";
import { streamOpenAICompletions } from "../src/providers/openai-completions";
import { streamOpenAIResponses } from "../src/providers/openai-responses";
import type { Context, Model } from "../src/types";

const originalFetch = global.fetch;
const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;

afterEach(() => {
	global.fetch = originalFetch;
	vi.restoreAllMocks();
	if (originalOpenAiBaseUrl === undefined) {
		delete process.env.OPENAI_BASE_URL;
	} else {
		process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;
	}
});

const testContext: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
};

function createUnauthorizedResponse(): Response {
	return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
		status: 401,
		headers: { "Content-Type": "application/json" },
	});
}

function getRequestUrl(input: string | URL | Request): string {
	if (input instanceof Request) {
		return input.url;
	}
	return typeof input === "string" ? input : input.toString();
}

function createAbortedSignal(): AbortSignal {
	const controller = new AbortController();
	controller.abort();
	return controller.signal;
}

describe("OpenAI base URL environment override", () => {
	it("uses OPENAI_BASE_URL for OpenAI model discovery when config baseUrl is absent", async () => {
		process.env.OPENAI_BASE_URL = "https://proxy.example/openai/";
		const requestedUrls: string[] = [];
		global.fetch = vi.fn(async (input: string | URL | Request) => {
			requestedUrls.push(getRequestUrl(input));
			return new Response(JSON.stringify({ data: [{ id: "gpt-5.4", name: "GPT-5.4" }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const options = openaiModelManagerOptions({ apiKey: "test-key" });
		const models = await options.fetchDynamicModels?.();

		expect(models?.find(model => model.id === "gpt-5.4")?.baseUrl).toBe("https://proxy.example/openai");
		expect(requestedUrls[0]).toBe("https://proxy.example/openai/models");
	});

	it("uses OPENAI_BASE_URL for bundled OpenAI chat completions requests", async () => {
		process.env.OPENAI_BASE_URL = "https://proxy.example/openai";
		const requestedUrls: string[] = [];
		global.fetch = vi.fn(async (input: string | URL | Request) => {
			requestedUrls.push(getRequestUrl(input));
			return createUnauthorizedResponse();
		}) as unknown as typeof fetch;

		const model: Model<"openai-completions"> = {
			...getBundledModel("openai", "gpt-4o-mini"),
			api: "openai-completions",
		};
		const result = await streamOpenAICompletions(model, testContext, { apiKey: "test-key" }).result();

		expect(result.stopReason).toBe("error");
		expect(requestedUrls[0]).toBe("https://proxy.example/openai/chat/completions");
	});

	it("uses OPENAI_BASE_URL for bundled OpenAI responses requests and disables direct OpenAI prompt caching", async () => {
		process.env.OPENAI_BASE_URL = "https://proxy.example/openai";
		const requestedUrls: string[] = [];
		const { promise, resolve } = Promise.withResolvers<unknown>();
		global.fetch = vi.fn(async (input: string | URL | Request) => {
			requestedUrls.push(getRequestUrl(input));
			return createUnauthorizedResponse();
		}) as unknown as typeof fetch;

		const model = getBundledModel("openai", "gpt-5-mini") as Model<"openai-responses">;
		streamOpenAIResponses(model, testContext, {
			apiKey: "test-key",
			cacheRetention: "long",
			sessionId: "session-1",
			signal: createAbortedSignal(),
			onPayload: payload => resolve(payload),
		});
		const payload = (await promise) as {
			prompt_cache_retention?: string;
		};
		const result = await streamOpenAIResponses(model, testContext, { apiKey: "test-key" }).result();

		expect(payload.prompt_cache_retention).toBeUndefined();
		expect(result.stopReason).toBe("error");
		expect(requestedUrls[0]).toBe("https://proxy.example/openai/responses");
	});
});
