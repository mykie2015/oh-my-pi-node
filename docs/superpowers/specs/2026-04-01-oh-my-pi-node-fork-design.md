# oh-my-pi Node Fork Design

Date: 2026-04-01

## Goal

Create a standalone fork of `can1357/oh-my-pi` in this workspace that:

- stays structurally close to upstream for future rebases
- removes Bun completely from normal development and runtime
- standardizes on `Node.js + pnpm`
- preserves the exact OpenAI-compatible behavior currently present only as uncommitted changes in `/Users/mykielee/GitHub/repo_refer/oh-my-pi`
- reaches a first usable milestone where `pnpm install` succeeds and the main CLI runs locally end-to-end

## Inputs

- Upstream reference source: `reference/oh-my-pi`
- External behavior reference for OpenAI-compatible changes:
  - `/Users/mykielee/GitHub/repo_refer/oh-my-pi/packages/ai/src/provider-models/openai-compat.ts`
  - `/Users/mykielee/GitHub/repo_refer/oh-my-pi/packages/ai/src/providers/openai-completions.ts`
  - `/Users/mykielee/GitHub/repo_refer/oh-my-pi/packages/ai/src/providers/openai-responses.ts`
  - `/Users/mykielee/GitHub/repo_refer/oh-my-pi/packages/ai/src/utils/openai-base-url.ts`
  - `/Users/mykielee/GitHub/repo_refer/oh-my-pi/packages/ai/test/openai-base-url.test.ts`

## Scope

In scope:

- convert the workspace root into the forked repository
- keep the upstream monorepo package layout and CLI entry point shape
- replace Bun package management, script execution, tests, env access, and runtime dependencies with Node-compatible equivalents
- port the referenced OpenAI base URL behavior exactly, then expand tests around it
- prioritize the execution path required for `pnpm install` and the main CLI

Out of scope for the first milestone:

- broad feature redesign
- provider behavior changes beyond the referenced uncommitted OpenAI-compatible work
- perfect one-pass parity for every maintainer-only or release-only script if they do not block install or main CLI startup

## Repository Strategy

The workspace root `/Users/mykielee/GitHub/my_projects/oh-my-pi-node` becomes the actual fork repository. The nested `reference/oh-my-pi` clone is a temporary bootstrap source and should not remain part of the final tracked source tree.

The fork will keep upstream package boundaries:

- `packages/coding-agent` remains the main CLI package
- `packages/ai` remains the model/provider abstraction layer
- `packages/agent`, `packages/tui`, `packages/utils`, `packages/stats`, and `packages/natives` stay in place unless Bun removal forces a targeted compatibility fix

This minimizes divergence and keeps upstream rebases practical.

## Toolchain Design

The fork standardizes on:

- Node.js 22 or newer as the runtime
- `pnpm` as the workspace package manager
- `tsx` as the TypeScript execution path for scripts and CLI startup
- `vitest` as the test runner

This requires replacing Bun responsibilities in four categories:

1. Workspace and install flow
   - replace Bun workspace commands with `pnpm` workspace commands
   - replace `bun.lock` with `pnpm-lock.yaml`
   - remove Bun engine requirements from package manifests

2. Script execution
   - convert `bun <script>.ts` and `bun --cwd=...` usage to `pnpm exec tsx` and `pnpm --dir ... exec tsx` equivalents
   - keep command names as close to upstream as possible so developer workflows remain familiar

3. Runtime APIs
   - replace direct Bun runtime APIs such as `Bun.env`, `Bun.file`, `Bun.write`, `Bun.sleep`, `Bun.spawn`, `Bun.spawnSync`, and Bun text imports with Node-compatible implementations
   - keep compatibility wrappers small and local so behavior stays readable and close to upstream intent

4. Tests
   - replace `bun:test` usage with `vitest`
   - preserve test semantics rather than test syntax

## OpenAI-Compatible Behavior

The following behavior from the external uncommitted changes is treated as required:

- introduce a shared OpenAI base URL utility
- use `OPENAI_BASE_URL` as the default override when no explicit OpenAI base URL is configured
- apply that override consistently to:
  - dynamic model discovery for OpenAI models
  - bundled OpenAI chat completions requests
  - bundled OpenAI responses requests
- preserve the precedence rule where an explicit non-default model base URL wins over the environment fallback
- preserve the prompt-caching behavior change for proxied OpenAI responses

The fork will copy this behavior exactly first, then add more test coverage around it under the Node-based toolchain.

## Execution Phases

### Phase 1: Fork bootstrap

- copy upstream source from `reference/oh-my-pi` into the workspace root
- keep the upstream file layout intact
- add upstream remote metadata for future rebases
- ensure temporary bootstrap artifacts do not pollute the final repo state

### Phase 2: Toolchain conversion

- replace root and package-level Bun scripts with `pnpm` and Node equivalents
- introduce any Node-side helper dependencies needed to run TypeScript scripts and tests
- remove Bun-specific manifest requirements and lockfiles
- port Bun-only runtime calls that block install or main CLI execution

### Phase 3: AI package parity

- port the external OpenAI-compatible changes into `packages/ai`
- migrate the referenced test to the Node-based runner
- add targeted tests for:
  - discovery URL resolution
  - completions URL resolution
  - responses URL resolution
  - base URL precedence between explicit values and `OPENAI_BASE_URL`

### Phase 4: Main CLI usability

- run the CLI through the Node-based entry path
- fix only the compatibility gaps that block end-to-end local startup
- defer non-blocking maintainer/release script cleanup until after the main path works

## Error Handling and Compatibility Rules

- when Bun removal exposes behavior that was previously implicit, prefer a small compatibility utility over broad refactors
- when a conversion choice would materially increase divergence from upstream, prefer the more conservative path unless it blocks the Node milestone
- do not widen provider semantics beyond the referenced external changes during the initial conversion
- if a package cannot be made fully Bun-free without a larger rewrite, isolate the gap explicitly and keep the first milestone focused on install plus main CLI execution

## Testing Strategy

The migration will follow a behavior-first strategy:

- port or add failing tests before changing runtime behavior
- verify the exact OpenAI-compatible behavior from the external reference under Node
- run workspace install validation with `pnpm install`
- run package-level tests where conversion risk is highest, especially `packages/ai`
- run the main CLI locally as the acceptance check for the first milestone

Success for the first milestone means:

- `pnpm install` completes successfully in the fork
- the main CLI entry point runs locally under Node
- the carried-over OpenAI-compatible behavior is covered by passing Node-based tests

## Main Risks

- upstream uses Bun deeply in scripts and runtime utilities, so some compatibility work may be broader than the initial script surface suggests
- native/build steps may have hidden Bun assumptions that only appear once the main CLI path is exercised
- converting every ancillary script immediately would slow the main objective, so work must stay disciplined around the install and CLI path first

## Recommendation

Implement the fork in the workspace root, keep the upstream structure, port only the minimum compatibility layer required for `Node.js + pnpm`, and treat the referenced OpenAI-compatible changes as baseline required behavior rather than optional enhancements. This provides the fastest path to a usable fork without making future upstream rebases unnecessarily expensive.
