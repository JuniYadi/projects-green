# Repository Guidelines

## Important

Use bun for all commands (for example `bun run dev`, `bun run test`) to ensure consistent environment and dependency resolution. Avoid using `npm` or `yarn` to prevent conflicts with the `bun.lockb` / `bun.lock` lockfile.

## Project Structure

Next.js 16 + TypeScript app with feature-oriented modules:

- `app/` — App Router pages, layouts, and route handlers
- `modules/` — Feature slices with colocated `api/`, `ui/`, service, and policy logic
- `components/` — Shared UI and layout components; `components/ui/` for primitives
- `lib/` — Shared utilities (validation, API clients, Prisma helpers)
- `prisma/` — Database schema and migrations
- `test/` — Global test bootstrap (`test/setup.ts`)
- `scripts/` — Operational scripts (role seeding, super-admin grant)

## Commands

- `bun run dev` — Dev server on `http://localhost:3300`
- `bun run build` — Production build
- `bun run lint` — ESLint (Next core-web-vitals + TypeScript rules)
- `bun run typecheck` — TypeScript checks without emit
- `bun run test` — Run Bun tests
- `bun run test:coverage` — Tests with text + lcov output
- `bun run prisma:migrate:dev` / `bun run prisma:generate` — DB migrations + client generation

## 4 Pillars Validation (HARD REQUIREMENT)

Must pass before opening a PR. **NOT** per-edit — run only when explicitly instructed:

1. `bun run lint` — 0 errors
2. `bun run typecheck` — 0 errors
3. `bun run test` — all tests pass
4. `bun run test:coverage` — line coverage acceptable
5. `bun run build` — production build succeeds

**NEVER open PR if any pillar fails.**

## Coding Style

- TypeScript strict mode; Prettier: 2-space indent, no semicolons, double quotes, 80-char width
- Path alias `@/*` for internal imports
- Name feature files by concern: `*.service.ts`, `*.route.ts`, `*.policy.ts`, etc.

## Engineering Principles

- **DRY**: extract shared helpers (fixtures, assertions) instead of copy-pasting
- **KISS**: straightforward implementations with clear intent; avoid over-engineering

---

## Implementation Rules (ON-DEMAND ONLY)

**Read `RULES.md` only when doing implementation work** (writing code, fixing bugs, adding tests). These rules DO NOT apply during planning, spec writing, design, or brainstorming sessions — skip them for those tasks.

Heavy rules in RULES.md:
- Prisma Types (Always Use Generated Types)
- DTO Layer (Boundary Contract)
- Testing Guidelines (mock.module cache rules)
- Console Surface Consistency
- E2E Test Scripts
- Commit & PR Guidelines
- Kanban Task Authoring Standard
