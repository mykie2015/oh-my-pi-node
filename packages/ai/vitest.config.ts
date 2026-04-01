import { defineConfig } from "vitest/config";
import { vitestTextAssetPlugin } from "../../scripts/vitest-text-assets";

export default defineConfig({
	plugins: [vitestTextAssetPlugin()],
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
	},
});
