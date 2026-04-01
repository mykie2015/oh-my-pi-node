import * as path from "node:path";
import { fileURLToPath } from "node:url";

export function moduleDir(importMetaUrl: string): string {
	return path.dirname(fileURLToPath(importMetaUrl));
}
