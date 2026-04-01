import { defineWorkspace } from "vitest/config";
import { vitestTextAssetPlugin } from "./scripts/vitest-text-assets";

export default defineWorkspace([
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "agent",
			root: "./packages/agent",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "ai",
			root: "./packages/ai",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "coding-agent",
			root: "./packages/coding-agent",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "natives",
			root: "./packages/natives",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "react-edit-benchmark",
			root: "./packages/react-edit-benchmark",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "tui",
			root: "./packages/tui",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		plugins: [vitestTextAssetPlugin()],
		test: {
			name: "utils",
			root: "./packages/utils",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
]);
