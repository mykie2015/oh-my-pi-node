import { readFile } from "node:fs/promises";

export async function load(url, context, nextLoad) {
	if (context.importAttributes?.type !== "text") {
		return nextLoad(url, context);
	}

	const source = await readFile(new URL(url), "utf8");
	return {
		format: "module",
		shortCircuit: true,
		source: `export default ${JSON.stringify(source)};`,
	};
}
