import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const TEXT_RE = /\.(md|txt|py|html)$/;

export async function resolve(specifier, context, nextResolve) {
	return nextResolve(specifier, {
		...context,
		importAttributes: {},
	});
}

export async function load(url, context, nextLoad) {
	if (!TEXT_RE.test(url) && context.importAttributes?.type !== "text") {
		return nextLoad(url, context);
	}

	const source = await readFile(fileURLToPath(url), "utf8");
	return {
		format: "module",
		shortCircuit: true,
		source: `export default ${JSON.stringify(source)};`,
	};
}
