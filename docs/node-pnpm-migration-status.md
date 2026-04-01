# Node + pnpm migration status

Date: 2026-04-02

This note documents the current state of the isolated Node fork work in `.worktrees/node-fork-exec`.

## Current outcome

The first usable Node milestone is working:

- `pnpm install` succeeds
- the native addon builds under Node via `pnpm --dir packages/natives run build:native`
- the main CLI starts under Node via `pnpm dev -- --help`
- model discovery works via `pnpm dev --list-models`
- a local end-to-end prompt against Ollama works via:

```bash
pnpm dev --model ollama/gpt-oss:20b -p "Reply with OK only." --no-tools --no-lsp --no-pty --no-session
```

Observed output:

```text
OK
```

The referenced uncommitted OpenAI-compatible behavior from `/Users/mykielee/GitHub/repo_refer/oh-my-pi` was also ported into `packages/ai`, with Node-based tests added around base URL resolution and first-event timeout behavior.

## Important caveat

Repo-wide Bun removal is not complete.

What is complete today is the validated Node path needed for local CLI usage. What is not complete is the broader cleanup of Bun-dependent code in secondary or unverified modules.

## Snapshot of remaining Bun usage

The current scan used:

```bash
rg -n 'from "bun"|Bun\.|bun:' packages -g '!**/test/**' -g '!**/*.test.*'
```

Results at this snapshot:

- `145` matching files under `packages/`
- `127` matching files under `packages/**/src`
- most of the remaining surface is in `packages/coding-agent`

Package concentration from the broader scan:

- `packages/coding-agent`: `102` files
- `packages/tui`: `12` files
- `packages/ai`: `12` files
- `packages/react-edit-benchmark`: `6` files
- `packages/utils`: `5` files
- `packages/swarm-extension`: `4` files
- `packages/stats`: `3` files
- `packages/natives`: `1` file

These counts include runtime code plus some package-local docs, scripts, and benches. The runtime-only `src` scan is smaller, but it still shows a substantial Bun footprint outside the path already exercised.

## Verified Node-side fixes already in place

The exercised CLI path no longer depends on Bun for the pieces already converted. This includes targeted compatibility fixes in:

- `packages/coding-agent/src/ssh/sshfs-mount.ts`
- `packages/coding-agent/src/stt/downloader.ts`
- `packages/coding-agent/src/stt/recorder.ts`
- `packages/coding-agent/src/modes/controllers/command-controller.ts`
- `packages/coding-agent/src/task/index.ts`
- `packages/coding-agent/src/task/worktree.ts`
- `packages/coding-agent/src/tools/index.ts`
- `packages/coding-agent/src/patch/index.ts`
- `packages/coding-agent/src/patch/hashline.ts`
- `packages/coding-agent/src/extensibility/plugins/loader.ts`
- `packages/coding-agent/src/extensibility/extensions/wrapper.ts`
- `packages/coding-agent/src/modes/components/agent-dashboard.ts`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/agent/src/agent.ts`

OpenAI-compatible provider work also added:

- `packages/ai/src/utils/openai-base-url.ts`
- provider-aware timeout handling for local OpenAI-compatible endpoints
- Node tests covering base URL resolution and first-event timeout behavior

## Remaining Bun-heavy areas by impact

### High-priority runtime and support code

These files are still the highest-value remaining Bun targets because they sit close to process orchestration, session persistence, notebook support, or core feature expansion beyond the narrow CLI smoke path.

- [`../packages/utils/src/procmgr.ts`](../packages/utils/src/procmgr.ts)
  Uses `Bun.env`, `Bun.which`, and `Bun.sleep`.
- [`../packages/utils/src/ptree.ts`](../packages/utils/src/ptree.ts)
  Still uses `Bun.sleep`.
- [`../packages/coding-agent/src/session/streaming-output.ts`](../packages/coding-agent/src/session/streaming-output.ts)
  Still depends on `Bun.FileSink` and `Bun.file(...).writer()`.
- [`../packages/coding-agent/src/session/session-manager.ts`](../packages/coding-agent/src/session/session-manager.ts)
  Still uses `Bun.write`, `Bun.file(...).text()`, and `Bun.Glob`.
- [`../packages/coding-agent/src/ipy/gateway-coordinator.ts`](../packages/coding-agent/src/ipy/gateway-coordinator.ts)
  Still uses Bun subprocess types, `Bun.write`, `Bun.file`, `Bun.sleep`, and `Bun.spawn`.
- [`../packages/coding-agent/src/config/file-lock.ts`](../packages/coding-agent/src/config/file-lock.ts)
  Still uses `Bun.write` and `Bun.sleep`.
- [`../packages/coding-agent/src/config/prompt-templates.ts`](../packages/coding-agent/src/config/prompt-templates.ts)
  Still uses `Bun.Glob` and `Bun.file`.
- [`../packages/coding-agent/src/config/model-resolver.ts`](../packages/coding-agent/src/config/model-resolver.ts)
  Still uses `Bun.Glob`.
- [`../packages/coding-agent/src/extensibility/skills.ts`](../packages/coding-agent/src/extensibility/skills.ts)
  Still uses `Bun.Glob`.
- [`../packages/coding-agent/src/patch/applicator.ts`](../packages/coding-agent/src/patch/applicator.ts)
  Still uses `Bun.file` and `Bun.write`.

### Remaining TUI/runtime helpers

These are not blocking the verified CLI smoke path, but they remain Bun-specific in rendering and utility layers.

- [`../packages/tui/src/utils.ts`](../packages/tui/src/utils.ts)
  Uses `Bun.stringWidth`.
- [`../packages/tui/src/components/box.ts`](../packages/tui/src/components/box.ts)
  Uses `Bun.hash.xxHash64`.
- [`../packages/tui/src/components/markdown.ts`](../packages/tui/src/components/markdown.ts)
  Uses `Bun.hash.xxHash64` and `Bun.stripANSI`.
- [`../packages/tui/src/terminal.ts`](../packages/tui/src/terminal.ts)
  Still contains guarded `bun:ffi` loading.

### AI/provider edge paths still using Bun

These are provider-side or auth-side flows that were not part of the acceptance smoke path.

- [`../packages/ai/src/utils/oauth/callback-server.ts`](../packages/ai/src/utils/oauth/callback-server.ts)
  Still uses `Bun.serve`.
- [`../packages/ai/src/providers/cursor.ts`](../packages/ai/src/providers/cursor.ts)
  Still uses `Bun.JSON5.parse`.
- Several OAuth helpers still use `Bun.sleep`, `Bun.file`, or `Bun.write`.

### Plugin and extensibility management

These are important for full feature parity, but they were not required for the verified local Ollama run.

- [`../packages/coding-agent/src/extensibility/plugins/installer.ts`](../packages/coding-agent/src/extensibility/plugins/installer.ts)
  Still spawns `bun install` and `bun uninstall`.
- [`../packages/coding-agent/src/extensibility/plugins/manager.ts`](../packages/coding-agent/src/extensibility/plugins/manager.ts)
  Still uses `Bun.file`, `Bun.write`, `Bun.spawn`, and `bun install`.
- [`../packages/coding-agent/src/extensibility/plugins/marketplace/manager.ts`](../packages/coding-agent/src/extensibility/plugins/marketplace/manager.ts)
  Still uses `Bun.write`, `Bun.file`, and `Bun.semver.order`.
- [`../packages/coding-agent/src/extensibility/plugins/marketplace/registry.ts`](../packages/coding-agent/src/extensibility/plugins/marketplace/registry.ts)
  Still uses `Bun.write` and `Bun.file`.
- [`../packages/coding-agent/src/extensibility/plugins/doctor.ts`](../packages/coding-agent/src/extensibility/plugins/doctor.ts)
  Still uses `Bun.which` and `Bun.env`.

## Secondary packages still using Bun

These packages are outside the main CLI acceptance path and still need dedicated cleanup if the goal is complete Bun removal.

### Stats package

- [`../packages/stats/src/server.ts`](../packages/stats/src/server.ts)
  Uses `import { $ } from "bun"`, `Bun.Archive`, `Bun.write`, `Bun.file`, `Bun.hash`, and `Bun.serve`.
- [`../packages/stats/src/parser.ts`](../packages/stats/src/parser.ts)
  Uses `Bun.JSONL.parseChunk` and `Bun.file`.

### React edit benchmark tooling

- [`../packages/react-edit-benchmark/src/generate.ts`](../packages/react-edit-benchmark/src/generate.ts)
- [`../packages/react-edit-benchmark/src/index.ts`](../packages/react-edit-benchmark/src/index.ts)
- [`../packages/react-edit-benchmark/src/runner.ts`](../packages/react-edit-benchmark/src/runner.ts)
- [`../packages/react-edit-benchmark/src/tasks.ts`](../packages/react-edit-benchmark/src/tasks.ts)
- [`../packages/react-edit-benchmark/src/formatter.ts`](../packages/react-edit-benchmark/src/formatter.ts)
- [`../packages/react-edit-benchmark/src/verify.ts`](../packages/react-edit-benchmark/src/verify.ts)

This package still uses Bun file APIs, Bun archive helpers, Bun hashing, Bun sleep helpers, and `import { $ } from "bun"`.

### Swarm extension

- [`../packages/swarm-extension/src/cli.ts`](../packages/swarm-extension/src/cli.ts)
- [`../packages/swarm-extension/src/extension.ts`](../packages/swarm-extension/src/extension.ts)
- [`../packages/swarm-extension/src/swarm/state.ts`](../packages/swarm-extension/src/swarm/state.ts)
- [`../packages/swarm-extension/src/swarm/schema.ts`](../packages/swarm-extension/src/swarm/schema.ts)

This package still uses Bun file APIs and Bun YAML parsing.

### Debug-only tooling

- [`../packages/coding-agent/src/debug/system-info.ts`](../packages/coding-agent/src/debug/system-info.ts)
- [`../packages/coding-agent/src/debug/report-bundle.ts`](../packages/coding-agent/src/debug/report-bundle.ts)
- [`../packages/coding-agent/src/debug/profiler.ts`](../packages/coding-agent/src/debug/profiler.ts)

These use Bun runtime metadata, archive helpers, and Bun-only debug hooks such as heap snapshot generation.

## Why the local Ollama run needed an AI timeout fix

The last blocking issue on the validated Node path was not Bun itself.

The local Ollama endpoint took about `41s` to produce its first token. The OpenAI-family first-event watchdog default was only `15s`, so the request aborted before the first streamed event arrived. The fix was to let local OpenAI-compatible endpoints use the full idle timeout by default.

This means:

- local Ollama now works on the Node path without Bun
- the remaining Bun references listed above are real cleanup work, but they are not what caused the final local CLI abort

## Recommended next conversion batch

If the goal is to continue from the current milestone toward repo-wide Bun removal, the next highest-value batch is:

1. [`../packages/utils/src/procmgr.ts`](../packages/utils/src/procmgr.ts)
2. [`../packages/coding-agent/src/session/streaming-output.ts`](../packages/coding-agent/src/session/streaming-output.ts)
3. [`../packages/coding-agent/src/session/session-manager.ts`](../packages/coding-agent/src/session/session-manager.ts)
4. [`../packages/coding-agent/src/ipy/gateway-coordinator.ts`](../packages/coding-agent/src/ipy/gateway-coordinator.ts)
5. [`../packages/coding-agent/src/extensibility/plugins/manager.ts`](../packages/coding-agent/src/extensibility/plugins/manager.ts)
6. [`../packages/coding-agent/src/extensibility/plugins/installer.ts`](../packages/coding-agent/src/extensibility/plugins/installer.ts)

That batch removes Bun from the most important broader runtime and feature-management surfaces first, while staying aligned with the original migration strategy of keeping the fork close to upstream.

## Verification commands for the validated path

The current Node milestone was verified with:

```bash
pnpm --dir packages/natives run build:native
pnpm --dir packages/tui exec vitest run test/node-terminal-capabilities.test.ts
pnpm --dir packages/ai exec vitest run test/openai-first-event-timeout.test.ts --config vitest.config.ts
pnpm --dir packages/coding-agent exec vitest run \
  test/node-model-registry.test.ts \
  test/node-theme-init.test.ts \
  test/node-marketplace-fetcher.test.ts \
  test/node-system-prompt.test.ts \
  test/node-status-line.test.ts \
  test/node-ipy-kernel.test.ts \
  test/node-sshfs-mount.test.ts \
  test/node-stt-downloader.test.ts \
  test/node-stt-recorder.test.ts \
  test/node-command-controller.test.ts
pnpm dev -- --help
pnpm dev --list-models
pnpm dev --model ollama/gpt-oss:20b -p "Reply with OK only." --no-tools --no-lsp --no-pty --no-session
```

## Bottom line

The fork has already crossed the first practical milestone: local install and the main CLI run under `Node.js + pnpm`, including the referenced OpenAI-compatible behavior.

The repo has not yet crossed the stronger milestone of complete Bun removal. The remaining work is now mostly concentrated in `packages/coding-agent`, plus a smaller set of TUI, AI edge-path, stats, benchmark, and extension modules.
