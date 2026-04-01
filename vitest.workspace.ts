import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		test: {
			name: "agent",
			root: "./packages/agent",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		test: {
			name: "ai",
			root: "./packages/ai",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		test: {
			name: "coding-agent",
			root: "./packages/coding-agent",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		test: {
			name: "natives",
			root: "./packages/natives",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		test: {
			name: "react-edit-benchmark",
			root: "./packages/react-edit-benchmark",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		test: {
			name: "tui",
			root: "./packages/tui",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
	{
		test: {
			name: "utils",
			root: "./packages/utils",
			environment: "node",
			include: ["test/**/*.test.ts"],
		},
	},
]);
