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

- Normal local work uses changed-path validation: run
  `bun run lint -- <changed lintable paths>`, `bun run test:changed`, and, for
  behavior changes, `bun run test:coverage:changed`. These commands are the
  default local checks; do not run repository-wide tests or coverage after
  every edit.
- `test:changed` reports changed production paths that have no paired test or
  feature mapping. Add a targeted test with
  `bun run test:changed -- --test <path>` or record an intentional gap with
  `--allow-unmapped`; neither path may be treated as silently validated.
- The final pre-PR checkpoint runs the applicable changed-path lint/tests/
  coverage commands and one full `bun run typecheck`. Typecheck has no safe
  changed-file equivalent, so do not repeat it after each edit.
- Run global `bun run test` and `bun run test:coverage` only for an explicit
  user or CI request, or for a documented high-blast-radius change such as
  shared test setup, test-selection tooling, or production code that cannot
  be mapped to an affected module.

## Local hard rules

- Use `bun` for project commands. Do not use `npm` or `yarn`.
- Never run destructive Prisma commands: `bunx prisma migrate reset*`, `bunx prisma db push --force-reset`, `bunx prisma db push --accept-data-loss`, `prisma migrate reset*`, `prisma db push --force-reset`, or `prisma db push --accept-data-loss`.
- Safe Prisma commands: `bun run prisma:migrate:dev` and `bun run prisma:generate`.
- TypeScript style: strict types, 2-space indent, no semicolons, double quotes, 80-char line width, `@/*` imports.
- Prisma types must come from `@prisma/client`; do not declare manual model, delegate, or enum mirror types. Refactor touched violations.
- API responses must use explicit DTOs (`*.dto.ts` plus `toDTO` mapper). Internal service-to-service calls use Prisma types directly.
- WorkOS user/org names must resolve through `lib/workos-directory.ts`; do not use deprecated WorkOS cache/sidebar hooks.
- Bun tests: mock leaf infrastructure only, put `mock.module()` before imports, use `mockClear()` plus explicit defaults in `beforeEach`, and run `bun run test:coverage` if mock setup changes.
- Console pages under `app/[lang]/console/**` use the shared console spacing (`flex flex-1 flex-col gap-6 p-6 pt-0`) and shared table patterns unless product design requires otherwise.
- Vault docs are the product/domain source of truth. If vault docs conflict with code, update code or flag the mismatch; do not duplicate domain docs in the repository.

## Project map

- `app/`: Next.js App Router pages, layouts, route handlers.
- `modules/`: feature slices with API, service, policy, and UI code.
- `components/`: shared UI/layout primitives.
- `lib/`: shared utilities, platform helpers, Prisma/API clients.
- `prisma/`: schema and migrations.
- `test/`: Bun test setup.
- `scripts/`: operational scripts.

## E2E verification (codex-driven)

- `scripts/e2e-agent.sh <user|admin|public> <spec-path> "<flow prompt>" [feature_key]`
  drives a real browser through an isolated `codex exec` subprocess — its MCP
  tool calls and DOM snapshots never enter the calling agent's context, only
  the small schema-validated result does. `.codex/config.toml` defines the
  browser tools: `user_browser`/`admin_browser` attach to a Chrome you already
  logged into on `:9222`/`:9223` (console/portal roles); `public_browser` is
  an isolated headless profile for no-auth pages.
- Pass `feature_key` to also have that same codex process update the matching
  row on the vault's E2E checklist per `Skill - E2E Feature Verification` and
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
