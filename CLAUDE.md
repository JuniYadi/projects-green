# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use **bun** (never npm/yarn — prevents lockfile conflicts):

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server on http://localhost:3300 (Turbopack) |
| `bun run build` | Production build |
| `bun run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `bun run format` | Prettier format all TS/TSX |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | Run all tests |
| `bun run test:coverage` | Tests with text + lcov coverage |
| `bun run prisma:generate` | Regenerate Prisma client |
| `bun run prisma:migrate:dev` | Apply DB migrations |
| `bun run worker:github` | Start GitHub webhook queue worker |

Run a single test file: `bun test path/to/file.test.ts`

## Validation Requirements (3 Pillars)

**HARD REQUIREMENT:** Must pass before opening a PR. **NOT** per-edit — run only when explicitly instructed to open a PR (saves tokens during local work):

1. `bun run lint` — 0 errors
2. `bun run typecheck` — 0 errors
3. `bun run test` — all tests pass

Build and coverage are CI-only (handled by `typecheck-build.yml` and `coverage-codecov.yml`).

**Never open PR if any pillar fails. Do NOT run these during local development — only when the user asks you to open a PR.**

## Architecture

**Next.js 16 App Router** (React 19, TypeScript strict, Turbopack) multi-tenant SaaS platform.

### API Layer: Elysia inside Next.js

All API routes run through **Elysia.js** in a single catch-all route (`app/api/[[...slugs]]/route.ts`). Each module defines its own `*.route.ts` using `new Elysia()`, composed via `.use()` in `lib/api.ts`. Type-safe client access via **Eden Treaty** (`lib/eden.ts`) using the exported `App` type.

Validation errors return: `{ ok: false, error: "VALIDATION_ERROR", message, fieldErrors }`.

### Auth & Roles

- **WorkOS AuthKit** for authentication (password, magic code, email verification)
- Two-layer role model:
  - **Platform role**: `super_admin` in DB (`PlatformUserRole` table)
  - **Tenant role** (WorkOS org): `owner`, `admin`, `member`
- Middleware (`proxy.ts`) routes `/portal` for admin/owner, `/console` for member; super_admin gets full access
- Protected layouts use `withAuth({ ensureSignedIn: true })` and redirect to onboarding if no org

### Module Convention

Feature code lives in `modules/<feature>/` with files named by concern:

- `*.service.ts` — business logic
- `*.route.ts` — Elysia API routes (in `api/` subdir)
- `*.policy.ts` — authorization rules
- `*.types.ts`, `*.schema.ts` — types and Zod validation
- `*.logic.ts` — pure logic functions
- UI components in `ui/` subdir
- Tests co-located as `*.test.ts` / `*.test.tsx`

Route factories (e.g. `createAuthRoutes(service)`) enable dependency injection for testing.

### Background Processing

GitHub webhooks are stored in DB and enqueued to **BullMQ** (Redis 7). A separate worker process (`scripts/github-worker.ts`) processes the queue with concurrency 4 and idempotent DB-level locking.

### Feature Flags

Env-var based with `FEATURE_*` prefix, checked via `isFeatureEnabled()` from `lib/feature-flags.ts`.

## Key Files

- `lib/api.ts` — Central Elysia router (composes all module routes)
- `lib/eden.ts` — Eden Treaty client for type-safe API calls
- `lib/prisma.ts` — Prisma client singleton
- `lib/validation.ts` — Shared Zod schemas and error types
- `lib/platform-role.ts` — Platform-level role resolution
- `proxy.ts` — Next.js middleware (auth + role-based routing)

## Code Style

- Prettier: 2-space indent, no semicolons, double quotes, 80-char width, trailing comma ES5
- Path alias: `@/*` maps to project root
- UI primitives from `@/components/ui/*` (shadcn/ui v4 + Tailwind CSS v4 + Phosphor Icons)
- Validation: Zod v4

## Testing

- Runner: `bun test` (preloads `test/setup.ts` via `bunfig.toml`)
- UI tests: Testing Library + Happy DOM + `@testing-library/jest-dom` matchers
- Tests live next to source files

## Commits & PRs

- Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`
- Imperative, scoped summaries (e.g. `feat: add onboarding flow page`)
- For multiline PR bodies, write to a temp file and use `gh pr create --body-file <file>`

## Infrastructure

- Docker Compose: PostgreSQL 16 (pgvector) + Redis 7
- Env vars from `.env.example` (DATABASE_URL, REDIS_URL, WorkOS keys, GitHub App keys)
- `DATABASE_URL` must be explicitly exported when running Prisma CLI outside the app

## Engineering Principles

- **DRY**: extract shared helpers instead of copy-pasting (especially in tests)
- **KISS**: prefer straightforward implementations; avoid over-engineering
- **Prisma Types — Use Generated Only**: never declare manual model types, delegates, or enum aliases. Import from `@prisma/client` instead (resolves via `node_modules/.prisma/client/`). See AGENTS.md for details and examples.
- **DTO at API Boundary**: every route handler response must go through a DTO (`*.dto.ts` + `toDTO` mapper). Internal service-to-service calls use Prisma types directly. See AGENTS.md for the layer-by-layer breakdown.
- **3 Pillars**: lint, typecheck, and test MUST pass before any commit/PR

<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
