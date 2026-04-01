import { $env } from "@oh-my-pi/pi-utils";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export function normalizeOpenAIBaseUrl(baseUrl?: string): string | undefined {
	const trimmed = baseUrl?.trim();
	if (!trimmed) {
		return undefined;
	}
	return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function resolveOpenAIBaseUrl(baseUrl?: string): string {
	return normalizeOpenAIBaseUrl(baseUrl) ?? normalizeOpenAIBaseUrl($env.OPENAI_BASE_URL) ?? DEFAULT_OPENAI_BASE_URL;
}

export function resolveOpenAIModelBaseUrl(baseUrl?: string): string {
	const normalizedBaseUrl = normalizeOpenAIBaseUrl(baseUrl);
	if (normalizedBaseUrl && normalizedBaseUrl !== DEFAULT_OPENAI_BASE_URL) {
		return normalizedBaseUrl;
	}
	return normalizeOpenAIBaseUrl($env.OPENAI_BASE_URL) ?? normalizedBaseUrl ?? DEFAULT_OPENAI_BASE_URL;
}

export function isLocalOpenAIBaseUrl(baseUrl?: string): boolean {
	const normalized = normalizeOpenAIBaseUrl(baseUrl);
	if (!normalized) return false;
	try {
		const url = new URL(normalized);
		const host = url.hostname.toLowerCase();
		if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "[::1]") {
			return true;
		}
		if (host.startsWith("127.")) return true;
		if (host.startsWith("10.")) return true;
		if (host.startsWith("192.168.")) return true;
		if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
		return false;
	} catch {
		return false;
	}
}
