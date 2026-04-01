import { describe, expect, it } from "vitest";

describe("terminal capabilities under node", () => {
	it("imports without requiring Bun globals", async () => {
		const module = await import("../src/terminal-capabilities");

		expect(module.TERMINAL_ID).toBeTypeOf("string");
		expect(module.TERMINAL).toBeDefined();
	});
});
