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
- Vault docs are the product/domain source of truth. If vault docs conflict with code, update code or flag the mismatch; do not duplicate domain docs in the repository.

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

## App Hosting Template Marketplace & Zero-Trust Auto-Provisioning Tracker

Master tracking state for App Hosting Template Marketplace and Zero-Trust Vault provisioning.

### ✅ Fase 0: Architectural Design & Security Runbooks (Complete)
- [x] **Spec 0.1:** Obsidian PRD — `PRD - App Hosting Template Marketplace and Custom Blueprint Engine`
- [x] **Spec 0.2:** Obsidian PRD — `PRD - App Hosting Unified Billing, Subscription Order, and Zero-Trust Provisioning Pipeline`
- [x] **Spec 0.3:** Operations Runbook — `Runbook - HashiCorp Vault Setup, AppRole Policies, and Kubernetes ESO Integration`

### ✅ Fase 1: App Hosting & Vault Core Backend (Foundation - Complete in PR #578)
- [x] **Issue 1:** `AppTemplate` Database Schema, Category/Visibility Enums, and 5 Official Templates Seed
- [x] **Issue 2:** Declarative Zod Blueprint Engine, Validator Service & Auto-Gen Hex Secret Generator
- [x] **Issue 3:** Zero-Trust Vault Migration for Cluster Integration Secrets (`admin/clusters/{clusterId}/integrations/{type}`)
- [x] **Issue 4:** Elysia Template Marketplace API Routes (`/api/templates`), Public/Workspace Scoping & Anti-IDOR

### ✅ Fase 2: Billing & Auto-Provisioning Pipeline (Complete in PR #578)
- [x] **Issue 5:** Global Catalog Editor `AppHostingProvisionAdapter` Persistence & Database Dependencies Multiselect
- [x] **Issue 6:** Order Fulfillment Engine Atomic Multi-Stock Claim (`AppManagedStock`) & Canonical Tenant Vault Copy
- [x] **Issue 7:** Billing Gating `INSUFFICIENT_PAYG_BUFFER` (min. 24h balance) & Monthly Subscription Slot Deductions

### ✅ Fase 3: Console UX & Template Marketplace (Complete in PR #578)
- [x] **Issue 8:** Console Showcase Hub (`/console/marketplace`): Featured hero banner, category chips, real-time search, verified green badge, and resource requirement chips
- [x] **Issue 9:** 1-Click Dynamic Launch Drawer: Right-side sheet form generator from `envSchema`, auto-subdomain suggest, and live PAYG/Subscription indicator
- [x] **Issue 10:** Custom Template Visual Builder (`/console/marketplace/builder`) & *"Save Stack as Template"* export action in Stack Details

### ⏳ Fase 4: Portal Moderation & End-to-End Verification (Pending)
- [ ] **Issue 11:** Super Admin Moderation Portal (`/portal/marketplace`): Review queue for public templates (`PENDING_REVIEW`), blueprint security inspector, approve/reject actions
- [ ] **Issue 12:** End-to-End Verification: Complete browser 1-click launch flow to live Kubernetes Pod with automated billing deduction audit
