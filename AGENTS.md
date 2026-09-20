# Repository Guidelines

## Context loading

1. Read this file for repo-local non-negotiables.
2. Load Obsidian only when the user explicitly references the vault, Obsidian,
   a note, a wikilink, or an `obsidian://` URL. Then read repo-root
   `.obsidian.json` (at `{repo-root}/.obsidian.json`, NOT anywhere else), run
   `bun run obsidian:boot`, and use `skill://obsidian-load` to follow the entry
   note's Agent flow.
3. Once Obsidian loading is triggered, read notes by logical name:
   `bun run obsidian:read -- "Note Name"` or
   `bun run obsidian:resolve -- "Note Name"`. Never construct filesystem paths
   from wikilinks; never use grep/find for note resolution. For
   `obsidian://open?vault=<name>&file=<path>` URLs (explicit vault-relative
   paths, not logical names), use `skill://obsidian-resolve` first, then
   `skill://obsidian-load`.

## Local validation matrix

- Normal local work MUST use fast, targeted validation:
  - For single-file / unit edits: run targeted test directly with
    `bun test <exact test file>` (e.g. `bun test modules/foo/foo.test.ts`).
  - Never run full test suites or multi-module tests for local iterative edits.
  - Never run full repository `typecheck` (`bun run typecheck` / `tsc --noEmit`)
    as it is too heavy and slow. Rely on IDE/LSP diagnostics, `bun test <file>`,
    and targeted checks. If type checking is needed, verify only the changed files.
- For PR preparation or feature checkpoints:
  - Run `bun run lint -- <changed paths>` and `bun run test:changed` (or `bun run test:coverage:changed`).
  - Do not run full `bun run typecheck`.
  - `test:changed` reports changed production paths without paired test mappings.
    Target them via `bun run test:changed -- --test <path>` or `--allow-unmapped`.
- Run global `bun run test` and `bun run test:coverage` ONLY for an explicit
  user request or high-blast-radius changes (shared test setup, test engine).
- Type-error backlog — `./check.sh` is the ONE exception to the no-full-typecheck
  rule above. Run it ONLY when a full typecheck already failed somewhere else:
  `pre-push` rejected the push, CI Typecheck is red, or the user asks. Never
  during iterative edits, and never for a single error already visible in
  diagnostics — fix that one directly instead of paying for a codex round.
  It needs a clean working tree, fixes one error per round, and commits each
  verified fix itself.

## Local hard rules
- NEVER use `git add -f` / `git commit -f` to force-stage gitignored files or directories. Strict adherence to `.gitignore` is mandatory.

- Use `bun` for project commands. Do not use `npm` or `yarn`.
- Never run destructive Prisma commands: `bunx prisma migrate reset*`, `bunx prisma db push --force-reset`, `bunx prisma db push --accept-data-loss`, `prisma migrate reset*`, `prisma db push --force-reset`, or `prisma db push --accept-data-loss`.
- Safe Prisma commands: `bun run prisma:migrate:dev` and `bun run prisma:generate`.
- TypeScript style: strict types, 2-space indent, no semicolons, double quotes, 80-char line width, `@/*` imports.
- Prisma types must come from `@prisma/client`; do not declare manual model, delegate, or enum mirror types. Refactor touched violations.
- API responses must use explicit DTOs (`*.dto.ts` plus `toDTO` mapper). Internal service-to-service calls use Prisma types directly.
- WorkOS user/org names must resolve through `lib/workos-directory.ts`; do not use deprecated WorkOS cache/sidebar hooks.
- Bun tests: mock leaf infrastructure only, put `mock.module()` before imports, use `mockClear()` plus explicit defaults in `beforeEach`, and run `bun run test:coverage` if mock setup changes.
- Console pages under `app/[lang]/console/**` use the shared console spacing (`flex flex-1 flex-col gap-6 p-6 pt-0`) and shared table patterns unless product design requires otherwise.
- UI Color Hierarchy (60-30-10 Rule): Reserve primary green strictly for primary actions (CTA) and semantic success icons. Use neutral card surfaces (`bg-card`/`bg-background` + `border-border`) and muted text (`text-muted-foreground`) for cards, badges, and secondary elements to prevent green washout.
- Diagrams in vault docs/PRDs: never paste hand-drawn ASCII art into a note.
  Write the ASCII source, convert it with the vault's `Meta/Scripts/asciibob.sh`
  (needs svgbob: `brew install svgbob`, or `cargo install svgbob_cli` on Linux),
  and embed `![[<name>.svg]]`. One diagram per
  SVG file — the script rejects oversized or multi-diagram input. Procedure and
  svgbob gotchas: `Skill - Diagram in PRD` in the vault.
- Vault docs are the product/domain source of truth. If vault docs conflict with code, update code or flag the mismatch; do not duplicate domain docs in the repository.
- Portal vs. Console Routing & API Boundaries:
  - `/portal/**` is strictly the Super Admin platform workspace. It calls `/api/admin/**` endpoints (protected by `requireSuperAdmin` / `platformRole === "super_admin"`).
  - `/console/**` is strictly the Tenant / Organization member workspace. It calls tenant-scoped API endpoints (e.g. `/api/whatsapp/**`, `/api/billing/**`, `/api/**`) scoped to `auth.organizationId`.
  - NEVER swap or invert these paths: Console users accessing `/api/admin/**` will be rejected with 403 Forbidden.

## Project map

- `app/`: Next.js App Router pages, layouts, route handlers.
- `modules/`: feature slices with API, service, policy, and UI code.
- `components/`: shared UI/layout primitives.
- `lib/`: shared utilities, platform helpers, Prisma/API clients.
- `prisma/`: schema and migrations.
- `test/`: Bun test setup.
- `scripts/`: operational scripts.

## End-to-end verification (codex-driven)

- `scripts/e2e-agent.sh <user|admin|public> <spec-path> "<flow prompt>" [feature_key]`
  drives a real browser through an isolated `codex exec` subprocess — its MCP
  tool calls and DOM snapshots never enter the calling agent's context, only
  the small schema-validated result does. `.codex/config.toml` defines the
  browser tools: `user_browser`/`admin_browser` attach to a Chrome you already
  logged into on `:9222`/`:9223` (console/portal roles); `public_browser` is
  an isolated headless profile for no-auth pages.
- Pass `feature_key` to also have that same codex process update the matching
  row on the vault's end-to-end checklist per `Skill - E2E Feature Verification` and
  push — codex reads this file's Obsidian-loading steps automatically. Omit
  it for ad-hoc checks that aren't on the tracked board.
- Result schema: `.codex/e2e-result.schema.json` (strict JSON Schema — every
  object needs `additionalProperties: false` and every property listed in
  `required`, per the backend's structured-output constraints).
- Multi-step flows (clicking through to a second page) can outrun the calling
  shell's own timeout before `codex exec` itself finishes — the subprocess
  keeps running as an orphan. Before retrying a "failed"/timed-out call,
  check `ps aux | grep "codex exec"` for a still-running process with the
  same prompt and wait on its `--output-last-message` file instead of
  starting a second one against the same Chrome session.
- Codex has a built-in "in-app browser" skill (feature flags `in_app_browser`
  / `computer_use`) that it tries _before_ any explicitly configured MCP
  browser tool, routed through a `node_repl` server tied to the ChatGPT
  desktop app. When that path is slow or unresponsive it can hang the whole
  run indefinitely — near-zero CPU, no `~/.codex/sessions/**` activity, no
  `chrome-devtools-mcp` subprocess ever spawned. `scripts/e2e-agent.sh`
  passes `--disable in_app_browser --disable computer_use` on every call, but
  this did **not** reliably prevent the hang in practice (reproduced twice
  even with both disabled) — treat it as a minor mitigation, not a fix. The
  real safety net is a hard timeout: the wrapper backgrounds `codex exec` and
  kills it after `E2E_AGENT_TIMEOUT_SECS` (default 240s) if it hasn't
  finished, then fails fast so you can just retry instead of waiting
  indefinitely. If a run ever looks stuck before that timeout hits, confirm
  with `ps -o pid,etime,%cpu -p <pid>` (near-0% CPU for minutes = hung).

## Graphify (project-scoped, on demand)

- Use Graphify only for a source or repository task in this repository that
  needs codebase navigation: architecture, symbol relationships, call paths, or
  implementation locations. Do not load it for brainstorming, planning,
  prompt/prose edits, or other non-code work.
- When the user types `/graphify`, use the installed Graphify skill. If no graph
  exists yet, let the skill build one.
- When `graphify-out/graph.json` exists and Graphify is needed, query it before
  raw source browsing: use `graphify query "<question>"`, `graphify path "<A>"
"<B>"`, or `graphify explain "<concept>"` as appropriate.
- Dirty graph files are expected after hooks or incremental updates. Prefer the
  project-local wiki index for broad navigation and `GRAPH_REPORT.md` only when
  focused queries are insufficient.
- After relevant source-code changes in this repository, run `graphify update .`.
  Do not update the graph for prompt, documentation, or configuration-only edits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


<!-- AUTOPUS:BEGIN -->
# Autopus-ADK Harness

> 이 섹션은 Autopus-ADK에 의해 자동 생성됩니다. 수동으로 편집하지 마세요.

- **프로젝트**: projects-green
- **모드**: full
- **플랫폼**: claude-code, codex, antigravity-cli, opencode, omp

## Installed Components

Use the current tool's native skill and agent catalog. Load the requested workflow,
not every installed instruction. `auto skill list` and `auto skill info <name>`
provide optional built-in guidance without enlarging the default catalog.

- Claude: .claude/
- Codex: .codex/
- Antigravity: .agents/plugins/autopus/
- OpenCode: .opencode/
- Shared skills: .agents/skills/
- OMP: .omp/

Detailed generated-file ownership is recorded in `.autopus/<platform>-manifest.json`.

## Language Policy

- **Code comments**: en
- **Commit messages**: en
- **AI responses**: en

MANDATORY: Always respond in English. Do not respond in Korean or any other language unless explicitly requested by the user.

## Autopus Branding

For explicit `/auto` or `@auto` workflows, start with this banner and end with `🐙`.
Ordinary responses need no wrapper. Worker summaries remain concise evidence receipts.

```text
🐙 Autopus ─────────────────────────
  Project: {project-name} | Mode: {mode}
  SPEC: {draft} draft · {approved} approved · {implemented} in progress · {completed} completed
  Next: {next-step recommendation}
```

## Document Storage

Product code is separate from `.autopus/` harness state. Root project context and
cross-module SPECs belong to the meta repository; module-specific SPECs and
CHANGELOG changes belong to the owning module. SPECs live under the owner's
`.autopus/specs/`. Generated harness files and brainstorm/runtime output stay local
and are not commit candidates.

Allocate SPEC/BS IDs uniquely across root and module repositories. Before committing,
run `auto sync verify` to classify ownership and generated/runtime exclusions.
`auto check --hygiene --staged` is not a substitute for that ownership check.

## Native Execution

Use this runtime's native tool schemas, permissions, and model configuration.
Codex: invoke @auto or $codex-auto and load only the selected route.
Workers share cwd/filesystem unless actual isolation is established. The worker
ceiling is codex.agents.max_concurrent_threads; auto doctor distinguishes requested
from observed capacity. Configuration writes do not prove effective capacity.
OpenCode: invoke /auto <route> or /auto-<route>. Work inline by default;
use native subagents only for justified independent or isolated work.


## Core Guidelines

### Execution

Work inline by default. Delegate independent slices, necessary specialist review,
or work needing context isolation—not work merely spanning more files or lines.
Give workers owned/forbidden paths and acceptance criteria. Parallel writers need
disjoint ownership; dependencies and shared mutable state require sequencing.

Choose execution depth from scope, risk, uncertainty and known acceptance.
Small verified low-risk fixes stay inline; inspect missing facts before adding
steps. Plan high-risk or unclear work, and reassess after failure or scope growth.
Routing never waives applicable gates or changes the user's model preferences.

### Verification

Reproduce bugs and write meaningful tests before behavior changes. Run the affected
behavior and applicable checks before declaring completion. Honor explicit project
quality thresholds; do not invent universal file-size or coverage limits. Keep
permissions, user-owned files, and security/data-loss boundaries intact. Obtain
approval for destructive or production actions.
For greenfield dependencies or requested migrations, verify versions with primary
sources. Preserve existing brownfield major versions unless migration is requested.

### Worker Results

Return `owned_paths`, `changed_files`, `verification`, `blockers`, and
`next_required_step`. Report only observed execution, including failures. The parent
verifies evidence and integrates results; a worker's completion claim is not proof.

### Review and Completion

Separate initial finding discovery from verification of fixes. Do not repeat
unchanged reviews. Finish requested actionable work rather than stopping at a
phase boundary; report a concrete blocker when external input is truly required.
Read workflow details only as needed through native skill discovery.

## OpenCode V2 native contract

Use the advertised native tool catalog. Delegation uses subagent, not a shell
command. The required input fields are agent, description, and prompt:

```json
{"agent":"executor","description":"Implement scoped change","prompt":"Read the assigned context, change only owned files, and return verification."}
```

Only configured subagent-mode agents are eligible. New children need complete
instructions; they do not inherit the parent's conversation. Foreground calls
wait for completion. Use background: true only for independent work; completion
is delivered to the parent. Do not poll or treat the initial running status as
completion. To continue that same child, pass its returned sessionID; it must
belong to the current parent. Do not invent task IDs or cancellation tools.

Omit model unless the user explicitly requested an override. Native model
references use provider/model#variant; translate an Autopus --variant flag to
that suffix rather than forwarding --variant to the V2 CLI. Use shell with its
workdir field for commands. Plugin wiring uses the effective plugins setting;
registration alone does not prove hook execution. If the advertised schema
differs, stop that dispatch and report the mismatch rather than guessing.

<!-- AUTOPUS:END -->
