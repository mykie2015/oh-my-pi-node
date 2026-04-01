# oh-my-pi Node Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert this workspace into a standalone `oh-my-pi` fork that runs on `Node.js + pnpm`, preserves the referenced uncommitted OpenAI-compatible behavior exactly, and reaches a first usable milestone where `pnpm install` succeeds and the main CLI runs locally end-to-end.

**Architecture:** Bootstrap the upstream source tree into the workspace root, replace Bun’s workspace/test/runtime responsibilities with `pnpm`, `vitest`, Node helpers, and a small ESM text-asset loader, then port the external `packages/ai` OpenAI base URL changes verbatim and verify the CLI boot path under Node. Keep source layout close to upstream and isolate compatibility work into small shared helpers rather than broad refactors.

**Tech Stack:** Node.js 22+, pnpm, TypeScript, tsx, vitest, execa, yaml, jsonc-parser, fast-glob, which, semver, xxhashjs, tar-stream

---

## File Map

- `package.json`: root workspace scripts and dev toolchain
- `pnpm-workspace.yaml`: pnpm workspace declaration
- `vitest.workspace.ts`: shared vitest workspace runner
- `.gitignore`: ignore the temporary `reference/` bootstrap clone
- `scripts/text-loader.mjs`: Node ESM loader for `.md`, `.txt`, `.py`, and `.html` text assets
- `scripts/install.sh` and `scripts/install.ps1`: global install path switched from Bun to pnpm
- `packages/utils/src/runtime/module-path.ts`: `import.meta.url` to directory helper
- `packages/utils/src/runtime/fs.ts`: Node file helpers replacing `Bun.file`/`Bun.write`
- `packages/utils/src/runtime/glob.ts`: fast-glob wrapper replacing `Bun.Glob`
- `packages/utils/src/runtime/process.ts`: `sleep`, `which`, and child-process helpers
- `packages/utils/src/runtime/hash.ts`: deterministic xxhash helpers replacing `Bun.hash`
- `packages/utils/src/runtime/jsonl.ts`: JSONL chunk parsing helper replacing `Bun.JSONL.parseChunk`
- `packages/utils/src/env.ts`: environment overlay built on `process.env`
- `packages/utils/src/dirs.ts`: remove Bun-only version assumptions
- `packages/ai/src/utils/openai-base-url.ts`: exact referenced OpenAI base URL behavior
- `packages/coding-agent/src/cli.ts`: Node shebang and Bun runtime check removal
- `packages/coding-agent/src/main.ts`: Node-friendly version compare and stdin handling
- `packages/coding-agent/src/config.ts`: replace Bun JSONC/YAML helpers and `import.meta.dir`
- `packages/coding-agent/src/config/settings.ts`: replace Bun file/YAML access on config load/save
- `packages/coding-agent/src/extensibility/plugins/package-manager.ts`: pnpm-based plugin install/uninstall command builder
- `packages/coding-agent/src/extensibility/plugins/manager.ts`: use pnpm instead of Bun for plugin lifecycle
- `packages/coding-agent/src/extensibility/plugins/installer.ts`: use pnpm instead of Bun for plugin lifecycle
- `README.md`: update install/run instructions to Node.js + pnpm

### Task 1: Bootstrap the Upstream Source Tree Into the Workspace Root

**Files:**
- Modify: `.gitignore`
- Copy into root: `package.json`, `tsconfig.json`, `tsconfig.base.json`, `Cargo.toml`, `packages/**`, `scripts/**`, `docs/**`, `.omp/**`, `.github/**`, `README.md`, `LICENSE`, `biome.json`, `rust-toolchain.toml`, `rustfmt.toml`, `types/**`, and other tracked upstream files from `reference/oh-my-pi`

- [ ] **Step 1: Verify the root is still missing the upstream source tree**

Run:

```bash
test -f package.json
```

Expected: exit code `1` because the workspace root has not been bootstrapped yet.

- [ ] **Step 2: Copy the upstream source tree into the workspace root without copying the nested `.git` directory**

Run:

```bash
rsync -a --exclude '.git' reference/oh-my-pi/ ./
```

Expected: root now contains `package.json`, `packages/`, `scripts/`, `README.md`, and the other upstream files.

- [ ] **Step 3: Ignore the bootstrap clone so the final fork does not track a nested reference repo**

Update `.gitignore` to include:

```gitignore
reference/
```

- [ ] **Step 4: Add the upstream remote for future rebases**

Run:

```bash
git remote add upstream https://github.com/can1357/oh-my-pi.git
git remote -v
```

Expected: `upstream` appears in `git remote -v`.

- [ ] **Step 5: Verify the bootstrap result**

Run:

```bash
test -f package.json && test -d packages/coding-agent && test -d packages/ai
```

Expected: exit code `0`.

- [ ] **Step 6: Commit the bootstrap**

Run:

```bash
git add .gitignore package.json tsconfig.json tsconfig.base.json Cargo.toml README.md LICENSE biome.json rust-toolchain.toml rustfmt.toml .github .omp docs packages scripts types
git commit -m "chore: bootstrap oh-my-pi fork source tree"
```

### Task 2: Convert the Workspace Manifests and Test Harness to pnpm

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `vitest.workspace.ts`
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: `packages/agent/package.json`
- Modify: `packages/ai/package.json`
- Modify: `packages/coding-agent/package.json`
- Modify: `packages/natives/package.json`
- Modify: `packages/react-edit-benchmark/package.json`
- Modify: `packages/stats/package.json`
- Modify: `packages/swarm-extension/package.json`
- Modify: `packages/tui/package.json`
- Modify: `packages/utils/package.json`

- [ ] **Step 1: Prove pnpm cannot install the bootstrapped workspace yet**

Run:

```bash
pnpm install
```

Expected: FAIL with a workspace/package-manager error because the upstream manifests still assume Bun.

- [ ] **Step 2: Create the pnpm workspace file**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

- [ ] **Step 3: Rewrite the root manifest around pnpm, tsx, and vitest**

Update `package.json` so the top-level scripts look like:

```json
{
  "packageManager": "pnpm@10",
  "scripts": {
    "install:dev": "pnpm install",
    "dev": "node --import tsx --loader ./scripts/text-loader.mjs packages/coding-agent/src/cli.ts",
    "stats": "node --import tsx --loader ./scripts/text-loader.mjs packages/coding-agent/src/cli.ts stats",
    "test": "pnpm -r --if-present test",
    "check": "pnpm run check:ts && pnpm run check:rs",
    "check:ts": "biome check . && tsgo -p tsconfig.json",
    "check:rs": "cargo fmt --all -- --check && cargo clippy --workspace -- -D warnings",
    "lint": "pnpm run lint:ts && pnpm run lint:rs",
    "lint:ts": "biome lint .",
    "lint:rs": "cargo clippy --workspace -- -D warnings",
    "fmt": "pnpm run fmt:ts && pnpm run fmt:rs",
    "fmt:ts": "biome format --write .",
    "fmt:rs": "cargo fmt --all",
    "fix": "pnpm run fix:ts && pnpm run fix:rs",
    "fix:ts": "biome check --write --unsafe . && pnpm --dir packages/coding-agent run format-prompts && pnpm --dir packages/coding-agent run generate-docs-index",
    "fix:rs": "cargo fmt --all && cargo clippy --fix --allow-dirty --all-targets --no-deps --allow-staged --broken-code --allow-no-vcs",
    "build:native": "pnpm --dir packages/natives run build:native",
    "dev:native": "pnpm --dir packages/natives run dev:native",
    "generate-models": "pnpm --dir packages/ai run generate-models",
    "generate-docs-index": "pnpm --dir packages/coding-agent run generate-docs-index",
    "generate-template": "pnpm --dir packages/coding-agent run generate-template",
    "sync-exports": "pnpm exec tsx scripts/sync-exports.ts",
    "check-spoofed-versions": "pnpm exec tsx scripts/check-spoofed-versions.ts"
  }
}
```

Then add the shared dev tools:

```bash
pnpm add -Dw @types/node tsx vitest execa
pnpm --dir packages/utils add fast-glob which xxhashjs
pnpm --dir packages/coding-agent add yaml jsonc-parser semver
pnpm --dir packages/stats add tar-stream
```

- [ ] **Step 4: Update TypeScript and vitest workspace configuration**

Update `tsconfig.base.json` so the runtime types become:

```json
{
  "compilerOptions": {
    "types": ["node", "assets", "vitest/globals"]
  }
}
```

Create `vitest.workspace.ts`:

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace(["packages/*"]);
```

- [ ] **Step 5: Replace Bun package scripts in every package manifest**

Apply the same conversion pattern to each package manifest:

```json
{
  "scripts": {
    "test": "vitest run",
    "check": "tsgo -p tsconfig.json"
  }
}
```

For packages that run TypeScript scripts, switch to `pnpm exec tsx`, for example:

```json
{
  "scripts": {
    "generate-models": "pnpm exec tsx scripts/generate-models.ts",
    "format-prompts": "pnpm exec tsx scripts/format-prompts.ts",
    "generate-docs-index": "pnpm exec tsx scripts/generate-docs-index.ts",
    "build:native": "pnpm exec tsx scripts/build-native.ts",
    "embed:native": "pnpm exec tsx scripts/embed-native.ts"
  }
}
```

Also remove every `@types/bun` dev dependency and every `"engines": { "bun": ... }` block.

- [ ] **Step 6: Run pnpm install again and confirm the lockfile is created**

Run:

```bash
pnpm install
test -f pnpm-lock.yaml
```

Expected: install completes successfully and `pnpm-lock.yaml` exists.

- [ ] **Step 7: Commit the workspace conversion**

Run:

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml vitest.workspace.ts tsconfig.base.json packages/*/package.json
git commit -m "build: switch workspace manifests to pnpm"
```

### Task 3: Add Shared Node Runtime Compatibility Helpers in `packages/utils`

**Files:**
- Create: `packages/utils/src/runtime/module-path.ts`
- Create: `packages/utils/src/runtime/fs.ts`
- Create: `packages/utils/src/runtime/glob.ts`
- Create: `packages/utils/src/runtime/process.ts`
- Create: `packages/utils/src/runtime/hash.ts`
- Create: `packages/utils/src/runtime/jsonl.ts`
- Modify: `packages/utils/src/env.ts`
- Modify: `packages/utils/src/dirs.ts`
- Modify: `packages/utils/src/index.ts`
- Test: `packages/utils/test/node-runtime.test.ts`

- [ ] **Step 1: Write the failing utility tests**

Create `packages/utils/test/node-runtime.test.ts`:

```ts
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hashText64Base36,
  loadEnvIntoProcess,
  moduleDir,
  readJsonlChunk,
  sleep,
  writeTextFileEnsured,
} from "../src";

describe("node runtime helpers", () => {
  const fixtureDir = path.join(process.cwd(), "packages", "utils", "test", ".tmp-runtime");

  beforeEach(async () => {
    await writeTextFileEnsured(path.join(fixtureDir, ".keep"), "x");
  });

  afterEach(async () => {
    await import("node:fs/promises").then(fs => fs.rm(fixtureDir, { recursive: true, force: true }));
    delete process.env.PI_TMP_KEY;
  });

  it("returns a stable module directory from import.meta.url", () => {
    expect(moduleDir(import.meta.url)).toContain(path.join("packages", "utils", "test"));
  });

  it("loads .env values into process.env without overwriting existing values", async () => {
    process.env.PI_TMP_KEY = "keep-me";
    await writeTextFileEnsured(path.join(fixtureDir, ".env"), "PI_TMP_KEY=replace-me\\nPI_OTHER_KEY=loaded\\n");

    loadEnvIntoProcess(path.join(fixtureDir, ".env"));

    expect(process.env.PI_TMP_KEY).toBe("keep-me");
    expect(process.env.PI_OTHER_KEY).toBe("loaded");
  });

  it("parses jsonl chunks across line boundaries", () => {
    const chunk = Buffer.from('{"a":1}\\n{"b":2}\\n');
    const parsed = readJsonlChunk(chunk);
    expect(parsed.values).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("produces stable xxhash-like ids", () => {
    expect(hashText64Base36("omp")).toBe(hashText64Base36("omp"));
  });

  it("sleeps without Bun", async () => {
    const start = Date.now();
    await sleep(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails because the helpers do not exist yet**

Run:

```bash
pnpm --dir packages/utils exec vitest run test/node-runtime.test.ts
```

Expected: FAIL with unresolved exports from `../src`.

- [ ] **Step 3: Implement the shared runtime helpers**

Create `packages/utils/src/runtime/module-path.ts`:

```ts
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export function moduleDir(importMetaUrl: string): string {
  return path.dirname(fileURLToPath(importMetaUrl));
}
```

Create `packages/utils/src/runtime/fs.ts`:

```ts
import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function writeTextFileEnsured(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}
```

Create `packages/utils/src/runtime/process.ts`:

```ts
import { spawn, spawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import which from "which";

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function whichSync(name: string): string | undefined {
  try {
    return which.sync(name);
  } catch {
    return undefined;
  }
}

export function spawnProcess(command: string, args: string[], options: SpawnOptions = {}) {
  return spawn(command, args, options);
}

export function spawnProcessSync(command: string, args: string[], options: SpawnSyncOptions = {}) {
  return spawnSync(command, args, options);
}
```

Create `packages/utils/src/runtime/hash.ts`:

```ts
import XXH from "xxhashjs";

export function hashText64Base36(value: string): string {
  const hex = XXH.h64(value, 0x0).toString(16);
  return BigInt(`0x${hex}`).toString(36);
}
```

Create `packages/utils/src/runtime/jsonl.ts`:

```ts
export function readJsonlChunk(
  input: Uint8Array,
  start = 0,
  stop = input.length,
): { values: unknown[]; read: number; done: boolean; error?: Error } {
  const values: unknown[] = [];
  const text = Buffer.from(input.subarray(start, stop)).toString("utf8");
  let read = start;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    read += Buffer.byteLength(line) + 1;
    if (!trimmed) continue;
    try {
      values.push(JSON.parse(trimmed));
    } catch (error) {
      return { values, read, done: false, error: error as Error };
    }
  }
  return { values, read, done: text.endsWith("\n") };
}
```

Create `packages/utils/src/runtime/glob.ts`:

```ts
import fg from "fast-glob";

export async function scanGlob(pattern: string, cwd: string): Promise<string[]> {
  return fg(pattern, { cwd, dot: true, onlyFiles: false });
}

export function scanGlobSync(pattern: string, cwd: string): string[] {
  return fg.sync(pattern, { cwd, dot: true, onlyFiles: false });
}
```

Update `packages/utils/src/env.ts` to expose a reusable file loader:

```ts
export function loadEnvIntoProcess(filePath: string): void {
  const parsed = parseEnvFile(filePath);
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
```

- [ ] **Step 4: Rebuild `env.ts`, `dirs.ts`, and `index.ts` around `process.env` and the new helpers**

Update `packages/utils/src/env.ts` so the mutation path becomes:

```ts
for (const filePath of [
  path.join(process.cwd(), ".env"),
  path.join(getAgentDir(), ".env"),
  path.join(getConfigRootDir(), ".env"),
  path.join(os.homedir(), ".env"),
]) {
  loadEnvIntoProcess(filePath);
}

export const $env: Record<string, string> = process.env as Record<string, string>;
```

Update `packages/utils/src/dirs.ts` so it exports `VERSION` but drops `MIN_BUN_VERSION`.

Update `packages/utils/src/index.ts` to export the new helpers:

```ts
export * from "./runtime/module-path";
export * from "./runtime/fs";
export * from "./runtime/glob";
export * from "./runtime/process";
export * from "./runtime/hash";
export * from "./runtime/jsonl";
```

- [ ] **Step 5: Run the utility tests again**

Run:

```bash
pnpm --dir packages/utils exec vitest run test/node-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the shared runtime layer**

Run:

```bash
git add packages/utils/src/runtime packages/utils/src/env.ts packages/utils/src/dirs.ts packages/utils/src/index.ts packages/utils/test/node-runtime.test.ts
git commit -m "refactor: add node runtime compatibility helpers"
```

### Task 4: Make the CLI Boot Path Work Under Node

**Files:**
- Create: `scripts/text-loader.mjs`
- Modify: `package.json`
- Modify: `packages/coding-agent/package.json`
- Modify: `packages/coding-agent/src/cli.ts`
- Modify: `packages/coding-agent/src/main.ts`
- Modify: `packages/coding-agent/src/config.ts`
- Modify: `packages/coding-agent/src/config/settings.ts`
- Modify: `packages/coding-agent/src/secrets/index.ts`
- Modify: `packages/coding-agent/src/session/session-storage.ts`
- Modify: `packages/coding-agent/src/mcp/transports/stdio.ts`
- Modify: `packages/coding-agent/src/utils/changelog.ts`
- Test: `packages/coding-agent/test/node-cli-smoke.test.ts`

- [ ] **Step 1: Write the failing CLI smoke test**

Create `packages/coding-agent/test/node-cli-smoke.test.ts`:

```ts
import * as path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("node cli smoke", () => {
  it("prints root help under node + tsx", async () => {
    const cliPath = path.join(process.cwd(), "packages", "coding-agent", "src", "cli.ts");
    const loaderPath = path.join(process.cwd(), "scripts", "text-loader.mjs");

    const result = await execa("node", ["--import", "tsx", "--loader", loaderPath, cliPath, "--help"], {
      reject: false,
      env: { ...process.env, NO_COLOR: "1" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("AI coding assistant");
  });
});
```

- [ ] **Step 2: Run the smoke test and confirm it fails**

Run:

```bash
pnpm --dir packages/coding-agent exec vitest run test/node-cli-smoke.test.ts
```

Expected: FAIL because Node cannot yet resolve Bun text imports and the CLI still references Bun runtime APIs.

- [ ] **Step 3: Add a Node ESM text loader instead of rewriting every prompt import**

Create `scripts/text-loader.mjs`:

```js
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const TEXT_RE = /\.(md|txt|py|html)$/;

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, {
    ...context,
    importAttributes: {},
  });
  return resolved;
}

export async function load(url, context, nextLoad) {
  if (TEXT_RE.test(url)) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(source)};`,
    };
  }
  return nextLoad(url, context);
}
```

- [ ] **Step 4: Remove Bun from the CLI entry and boot helpers**

Update `packages/coding-agent/src/cli.ts`:

```ts
#!/usr/bin/env node
import { APP_NAME, VERSION } from "@oh-my-pi/pi-utils";

process.title = APP_NAME;
```

Delete the Bun version/errata checks entirely.

Update `packages/coding-agent/src/main.ts`:

```ts
import semverGt from "semver/functions/gt";

async function checkForNewVersion(currentVersion: string): Promise<string | undefined> {
  // ...
  if (latestVersion && semverGt(latestVersion, currentVersion)) {
    return latestVersion;
  }
  return undefined;
}

async function readPipedInput(): Promise<string | undefined> {
  if (process.stdin.isTTY !== false) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim().length > 0 ? text : undefined;
}
```

- [ ] **Step 5: Replace Bun config/file primitives on the CLI boot path**

Update `packages/coding-agent/src/config.ts`:

```ts
import { parse as parseJsonc } from "jsonc-parser";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { moduleDir, readTextFile, writeTextFileEnsured } from "@oh-my-pi/pi-utils";

let dir = moduleDir(import.meta.url);
// ...
parsed = this.#basePath.endsWith(".json") || this.#basePath.endsWith(".jsonc")
  ? parseJsonc(content)
  : parseYaml(content);
// ...
fs.writeFileSync(ymlPath, stringifyYaml(parsed));
```

Update `packages/coding-agent/src/config/settings.ts`, `packages/coding-agent/src/secrets/index.ts`, `packages/coding-agent/src/session/session-storage.ts`, `packages/coding-agent/src/utils/changelog.ts`, and `packages/coding-agent/src/mcp/transports/stdio.ts` to use the new `packages/utils` helpers instead of `Bun.file`, `Bun.write`, `Bun.Glob`, `Bun.spawn`, and Bun YAML helpers.

- [ ] **Step 6: Re-run the CLI smoke test**

Run:

```bash
pnpm --dir packages/coding-agent exec vitest run test/node-cli-smoke.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the CLI boot-path conversion**

Run:

```bash
git add scripts/text-loader.mjs package.json packages/coding-agent/package.json packages/coding-agent/src/cli.ts packages/coding-agent/src/main.ts packages/coding-agent/src/config.ts packages/coding-agent/src/config/settings.ts packages/coding-agent/src/secrets/index.ts packages/coding-agent/src/session/session-storage.ts packages/coding-agent/src/mcp/transports/stdio.ts packages/coding-agent/src/utils/changelog.ts packages/coding-agent/test/node-cli-smoke.test.ts
git commit -m "feat: run the coding agent cli on node"
```

### Task 5: Port the Referenced OpenAI-Compatible Changes Exactly Into `packages/ai`

**Files:**
- Create: `packages/ai/src/utils/openai-base-url.ts`
- Modify: `packages/ai/src/provider-models/openai-compat.ts`
- Modify: `packages/ai/src/providers/openai-completions.ts`
- Modify: `packages/ai/src/providers/openai-responses.ts`
- Test: `packages/ai/test/openai-base-url.test.ts`

- [ ] **Step 1: Write the failing AI behavior test using the exact external behavior**

Create `packages/ai/test/openai-base-url.test.ts`:

```ts
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
  if (input instanceof Request) return input.url;
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
    const payload = (await promise) as { prompt_cache_retention?: string };
    const result = await streamOpenAIResponses(model, testContext, { apiKey: "test-key" }).result();

    expect(payload.prompt_cache_retention).toBeUndefined();
    expect(result.stopReason).toBe("error");
    expect(requestedUrls[0]).toBe("https://proxy.example/openai/responses");
  });
});
```

- [ ] **Step 2: Run the new AI test and confirm it fails**

Run:

```bash
pnpm --dir packages/ai exec vitest run test/openai-base-url.test.ts
```

Expected: FAIL because `openai-base-url.ts` does not exist yet and the providers still use direct OpenAI defaults.

- [ ] **Step 3: Implement the exact external OpenAI base URL resolver**

Create `packages/ai/src/utils/openai-base-url.ts`:

```ts
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
```

- [ ] **Step 4: Apply the exact referenced diffs to the OpenAI provider files**

Update `packages/ai/src/provider-models/openai-compat.ts`:

```ts
import { resolveOpenAIBaseUrl } from "../utils/openai-base-url";

const baseUrl = resolveOpenAIBaseUrl(config?.baseUrl);
// ...
simpleModelsDevDescriptor("openai", "openai", "openai-responses", resolveOpenAIBaseUrl()),
```

Update `packages/ai/src/providers/openai-completions.ts`:

```ts
import { DEFAULT_OPENAI_BASE_URL, resolveOpenAIModelBaseUrl } from "../utils/openai-base-url";
// ...
url: `${baseUrl ?? DEFAULT_OPENAI_BASE_URL}/chat/completions`,
// ...
if (model.provider === "openai") {
  baseUrl = resolveOpenAIModelBaseUrl(model.baseUrl);
}
```

Update `packages/ai/src/providers/openai-responses.ts`:

```ts
import { DEFAULT_OPENAI_BASE_URL, resolveOpenAIModelBaseUrl } from "../utils/openai-base-url";
// ...
url: `${baseUrl ?? DEFAULT_OPENAI_BASE_URL}/responses`,
// ...
if (model.provider === "openai") {
  baseUrl = resolveOpenAIModelBaseUrl(model.baseUrl);
}
const baseUrl = model.provider === "openai" ? resolveOpenAIModelBaseUrl(model.baseUrl) : model.baseUrl;
const strictResponsesPairing =
  options?.strictResponsesPairing ??
  (isAzureOpenAIBaseUrl(baseUrl ?? "") || model.provider === "github-copilot");
prompt_cache_retention: promptCacheKey && baseUrl ? getPromptCacheRetention(baseUrl, cacheRetention) : undefined,
```

- [ ] **Step 5: Re-run the AI test and one neighboring regression test**

Run:

```bash
pnpm --dir packages/ai exec vitest run test/openai-base-url.test.ts test/github-copilot-openai-base-url.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the AI behavior port**

Run:

```bash
git add packages/ai/src/utils/openai-base-url.ts packages/ai/src/provider-models/openai-compat.ts packages/ai/src/providers/openai-completions.ts packages/ai/src/providers/openai-responses.ts packages/ai/test/openai-base-url.test.ts
git commit -m "feat(ai): honor OPENAI_BASE_URL for openai providers"
```

### Task 6: Replace Bun With pnpm in Plugin and Installer Flows

**Files:**
- Create: `packages/coding-agent/src/extensibility/plugins/package-manager.ts`
- Modify: `packages/coding-agent/src/extensibility/plugins/manager.ts`
- Modify: `packages/coding-agent/src/extensibility/plugins/installer.ts`
- Modify: `packages/coding-agent/src/cli/update-cli.ts`
- Modify: `packages/coding-agent/src/cli/setup-cli.ts`
- Modify: `scripts/install.sh`
- Modify: `scripts/install.ps1`
- Test: `packages/coding-agent/test/plugin-package-manager.test.ts`

- [ ] **Step 1: Write the failing plugin package-manager test**

Create `packages/coding-agent/test/plugin-package-manager.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPluginInstallCommand, getPluginUninstallCommand } from "../src/extensibility/plugins/package-manager";

describe("plugin package manager", () => {
  it("builds pnpm add commands for plugin installation", () => {
    expect(getPluginInstallCommand("@oh-my-pi/exa")).toEqual(["pnpm", "add", "@oh-my-pi/exa"]);
  });

  it("builds pnpm remove commands for plugin uninstall", () => {
    expect(getPluginUninstallCommand("@oh-my-pi/exa")).toEqual(["pnpm", "remove", "@oh-my-pi/exa"]);
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
pnpm --dir packages/coding-agent exec vitest run test/plugin-package-manager.test.ts
```

Expected: FAIL because `package-manager.ts` does not exist yet.

- [ ] **Step 3: Introduce a single pnpm command builder and wire the plugin flows to it**

Create `packages/coding-agent/src/extensibility/plugins/package-manager.ts`:

```ts
export function getPluginInstallCommand(spec: string): string[] {
  return ["pnpm", "add", spec];
}

export function getPluginUninstallCommand(spec: string): string[] {
  return ["pnpm", "remove", spec];
}
```

Update `packages/coding-agent/src/extensibility/plugins/manager.ts` and `packages/coding-agent/src/extensibility/plugins/installer.ts` so every `Bun.spawn(["bun", "install", ...])` and `Bun.spawn(["bun", "uninstall", ...])` call is replaced by a Node child-process spawn using the arrays from `package-manager.ts`.

Update `packages/coding-agent/src/cli/update-cli.ts` and `packages/coding-agent/src/cli/setup-cli.ts` to use `whichSync("pnpm")` and the new process helpers instead of `Bun.which(...)`.

- [ ] **Step 4: Convert the shell installers to pnpm**

Update `scripts/install.sh`:

```bash
pnpm add -g "$TMP_DIR/packages/coding-agent"
```

Update `scripts/install.ps1`:

```powershell
pnpm add -g $packagePath
```

Also rewrite any help or error text that still tells users to install or upgrade Bun.

- [ ] **Step 5: Re-run the plugin package-manager test and shell syntax checks**

Run:

```bash
pnpm --dir packages/coding-agent exec vitest run test/plugin-package-manager.test.ts
bash -n scripts/install.sh
```

Expected: vitest passes and `bash -n` returns exit code `0`.

- [ ] **Step 6: Commit the package-manager replacement**

Run:

```bash
git add packages/coding-agent/src/extensibility/plugins/package-manager.ts packages/coding-agent/src/extensibility/plugins/manager.ts packages/coding-agent/src/extensibility/plugins/installer.ts packages/coding-agent/src/cli/update-cli.ts packages/coding-agent/src/cli/setup-cli.ts scripts/install.sh scripts/install.ps1 packages/coding-agent/test/plugin-package-manager.test.ts
git commit -m "refactor: replace bun package management flows with pnpm"
```

### Task 7: Sweep Residual Bun APIs Out of the Remaining First-Class Packages

**Files:**
- Modify: `packages/ai/src/**/*.ts`
- Modify: `packages/tui/src/**/*.ts`
- Modify: `packages/natives/src/**/*.ts`
- Modify: `packages/stats/src/**/*.ts`
- Modify: `packages/*/scripts/*.ts`
- Modify: `packages/*/test/**/*.ts`
- Modify: `scripts/*.ts`

- [ ] **Step 1: Prove Bun-specific runtime references still remain after the earlier tasks**

Run:

```bash
rg -n '\bBun\b|from "bun"|from '\''bun'\''|bun:test|import\.meta\.dir' packages/ai packages/tui packages/natives packages/stats packages/utils packages/coding-agent scripts
```

Expected: FAIL with remaining Bun-specific references outside docs and changelogs.

- [ ] **Step 2: Replace the remaining Bun API categories with the shared Node helpers**

Apply these replacement patterns in the remaining first-class packages:

```ts
// Sleep
await sleep(100);

// Which
const binary = whichSync("uv");

// File reads/writes
const content = await readTextFile(filePath);
await writeTextFileEnsured(filePath, content);

// Globbing
const entries = await scanGlob("**/*.jsonl", sessionsRoot);

// Hashing
const id = hashText64Base36(seedText);

// Child processes
const proc = spawnProcess("git", ["status"], { stdio: "pipe" });
```

For `packages/stats/src/server.ts` and `packages/ai/src/utils/oauth/callback-server.ts`, replace `Bun.serve(...)` with a Node `http.createServer(...)` implementation that preserves the same request routing and shutdown behavior.

For `packages/stats/src/server.ts`, `packages/stats/scripts/generate-client-bundle.ts`, and any other archive-extraction path, replace `Bun.Archive` usage with a `tar-stream`-based Node implementation and add `tar-stream` to `packages/stats/package.json`.

- [ ] **Step 3: Convert the remaining tests off `bun:test` and Bun-only fixtures**

Replace every remaining `bun:test` import with vitest imports:

```ts
import { describe, expect, it, vi } from "vitest";
```

Replace `Bun.sleep`, `Bun.file`, `Bun.write`, `Bun.which`, and `import.meta.dir` inside tests with the same Node-compatible helpers used in runtime code.

- [ ] **Step 4: Re-run the grep and confirm Bun is gone from first-class runtime code**

Run:

```bash
rg -n '\bBun\b|from "bun"|from '\''bun'\''|bun:test|import\.meta\.dir' packages/ai packages/tui packages/natives packages/stats packages/utils packages/coding-agent scripts
```

Expected: no matches in first-class runtime code, tests, or scripts.

- [ ] **Step 5: Run representative package test suites after the sweep**

Run:

```bash
pnpm --dir packages/ai exec vitest run
pnpm --dir packages/tui exec vitest run
pnpm --dir packages/natives exec vitest run
pnpm --dir packages/coding-agent exec vitest run
```

Expected: the representative package suites complete successfully.

- [ ] **Step 6: Commit the residual Bun sweep**

Run:

```bash
git add packages/ai packages/tui packages/natives packages/stats packages/utils packages/coding-agent scripts
git commit -m "refactor: remove remaining bun runtime dependencies"
```

### Task 8: Update Docs and Run the End-to-End Verification Matrix

**Files:**
- Modify: `README.md`
- Modify: `docs/models.md`
- Modify: `docs/environment-variables.md`

- [ ] **Step 1: Update the user-facing setup docs to Node.js + pnpm**

Update `README.md` install and development sections so the commands become:

```md
pnpm install
pnpm dev
pnpm test
```

Update `docs/models.md` and `docs/environment-variables.md` to document `OPENAI_BASE_URL` as the default OpenAI override in the Node fork.

- [ ] **Step 2: Run the end-to-end verification commands**

Run:

```bash
pnpm install
pnpm --dir packages/utils exec vitest run test/node-runtime.test.ts
pnpm --dir packages/ai exec vitest run test/openai-base-url.test.ts
pnpm --dir packages/coding-agent exec vitest run test/node-cli-smoke.test.ts test/plugin-package-manager.test.ts
rg -n '\bBun\b|from "bun"|from '\''bun'\''|bun:test|import\.meta\.dir' packages/ai packages/tui packages/natives packages/stats packages/utils packages/coding-agent scripts
pnpm dev -- --help
```

Expected:

- `pnpm install` exits `0`
- targeted vitest commands exit `0`
- the Bun-reference grep returns no matches
- `pnpm dev -- --help` exits `0` and prints the root CLI help text

- [ ] **Step 3: Commit the docs and verification pass**

Run:

```bash
git add README.md docs/models.md docs/environment-variables.md
git commit -m "docs: update node fork setup and openai override docs"
```

## Self-Review

- Spec coverage:
  - workspace root becomes the fork: covered by Task 1
  - `Node.js + pnpm` toolchain: covered by Tasks 2, 3, 4, and 6
  - exact external OpenAI-compatible behavior: covered by Task 5
  - first usable milestone `pnpm install` + main CLI runs: covered by Tasks 2, 4, and 7
  - stay close to upstream: handled by bootstrap-first strategy, helper isolation, and loader-based text asset approach
- Placeholder scan:
  - no `TODO`, `TBD`, or “implement later” markers remain
  - every task names exact files and concrete commands
- Type consistency:
  - shared helper names are used consistently: `moduleDir`, `writeTextFileEnsured`, `whichSync`, `hashText64Base36`, `readJsonlChunk`
