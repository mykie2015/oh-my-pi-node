import * as fs from "node:fs/promises";
import type { Plugin } from "vite";

const TEXT_ASSET_RE = /\.(md|txt|py|html)$/;

export function vitestTextAssetPlugin(): Plugin {
	return {
		name: "oh-my-pi-text-assets",
		enforce: "pre",
		async load(id) {
			const [filePath] = id.split("?", 1);
			if (!TEXT_ASSET_RE.test(filePath)) {
				return null;
			}
			const source = await fs.readFile(filePath, "utf8");
			return `export default ${JSON.stringify(source)};`;
		},
	};
}
