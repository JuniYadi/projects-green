# Repository Guidelines

## Important

Use bun for all commands (for example `bun run dev`, `bun run test`) to ensure consistent environment and dependency resolution. Avoid using `npm` or `yarn` to prevent conflicts with the `bun.lockb` / `bun.lock` lockfile.

## Project Structure & Module Organization
This is a Next.js 16 + TypeScript app with feature-oriented modules.

- `app/`: App Router pages, layouts, and route handlers (for example `app/console`, `app/portal`, `app/api/[[...slugs]]/route.ts`).
- `modules/`: Feature slices (`docs`, `tenants`) with colocated `api/`, `ui/`, service, and policy logic.
- `components/`: Shared UI and layout components; `components/ui/` contains reusable primitives.
- `lib/`: Shared utilities and platform helpers (validation, API clients, Prisma helpers).
- `prisma/`: Database schema and migrations.
- `test/`: Global test bootstrap (`test/setup.ts`).
- `scripts/`: Operational scripts (for example role seeding and super-admin grant).
- `public/`: Static assets.

## Build, Test, and Development Commands
- `bun run dev`: Start local dev server on `http://localhost:3300`.
- `bun run build`: Production build.
- `bun run start`: Run built app.
- `bun run lint`: Run ESLint (Next core-web-vitals + TypeScript rules).
- `bun run typecheck`: TypeScript checks without emit.
- `bun run test`: Run Bun tests.
- `bun run test:coverage`: Run tests with text + lcov output in `coverage/`.
- `bun run prisma:migrate:dev` / `bun run prisma:generate`: Apply DB migrations and refresh Prisma client.

**4 PILLARS VALIDATION (HARD REQUIREMENT):**
Before committing or opening a PR, ALL MUST PASS:
1. `bun run lint` — 0 errors
2. `bun run typecheck` — 0 errors
3. `bun run test` — all tests pass
4. `bun run test:coverage` — line coverage acceptable
5. `bun run build` — production build succeeds

**NEVER commit or open PR if any pillar fails.**

## Coding Style & Naming Conventions
- TypeScript-first; strict mode is enabled in `tsconfig.json`.
- Prettier rules: 2-space indent, no semicolons, double quotes, 80-char line width.
- Use path alias `@/*` for internal imports.
- Name feature files by concern (`*.service.ts`, `*.route.ts`, `*.policy.ts`) and tests as `*.test.ts` / `*.test.tsx`.

## Engineering Principles
- DRY (Don't Repeat Yourself): extract shared helpers for repeated setup, fixtures, and assertions (especially in tests) instead of copy-pasting logic across files.
- KISS (Keep It Simple, Stupid): prefer straightforward implementations and tests with clear intent; avoid over-engineering, unnecessary abstractions, and brittle test scaffolding.

## Console Surface Consistency
- Keep all pages under `app/[lang]/console/**` visually consistent with the console overview page structure.
- Use `main` wrapper class `flex flex-1 flex-col gap-6 p-6 pt-0` for content pages unless a parent layout already provides the same spacing contract.
- Use shared table primitives and the shared TanStack table pattern for tabular data so sorting, filtering, and column visibility behavior remains consistent between console pages.
- Avoid one-off page-specific spacing/layout patterns for invoices, support tickets, and other console subpages unless explicitly required by product design.

## Testing Guidelines
- Test runner: `bun test` (`bunfig.toml` preloads `test/setup.ts`).
- UI tests use Testing Library with Happy DOM and `@testing-library/jest-dom` matchers.
- Keep tests close to source files (examples: `modules/docs/docs.service.test.ts`, `components/nav-main.test.tsx`).
- Add or update tests for new behavior in API routes, tenant policy logic, and rendered UI states.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `test: ...`, `chore: ...`, `docs: ...`.
- Use imperative, scoped summaries (example: `feat: add onboarding flow page`).
- When opening PRs with GitHub CLI, write the body to a Markdown file and use `gh pr create --body-file <file>` to preserve newlines reliably; avoid inline `--body` for multiline text.
- PRs should include: problem/solution summary, linked issue (if available), test evidence (`bun run test`, `bun run lint`), and screenshots for UI changes.

## Kanban Task Authoring Standard
- Every Kanban task prompt must use this exact section order:
  - `Context`
  - `Goal`
  - `Scope of work`
  - `Validation`
  - `Acceptance criteria`
  - `Constraints`
  - `Deliverables`
- Content requirements by section:
  - `Context`: summarize relevant background, current state, and assumptions needed to execute the task without extra discovery.
  - `Goal`: define the intended end state in one clear outcome-focused statement.
  - `Scope of work`: provide an explicit numbered implementation plan with concrete actions, target files/surfaces, and boundaries.
  - `Validation`: list required checks (tests, lint, typecheck, manual verification) and define what must be verified.
  - `Acceptance criteria`: list objective, testable completion conditions that determine done/not done.
  - `Constraints`: capture non-negotiable limits, including tooling, style, safety, and out-of-scope rules.
  - `Deliverables`: list the exact artifacts expected at completion (files changed, outputs, and summary requirements).
- Task creation behavior defaults:
  - Create a single task by default; split into multiple tasks only when explicitly requested.
  - Use `baseRef=main` by default unless another base branch is explicitly requested.
  - Keep plan mode off by default; enable it only when explicitly requested.
  - Keep auto-review off by default; enable it only when explicitly requested.

## Security & Configuration Tips
- Copy required values from `.env.example`; never commit real secrets.
- Required integrations include PostgreSQL (`DATABASE_URL`) and WorkOS keys.
- Run role/bootstrap scripts via `bun run seed:workos-roles` and `bun run grant:super-admin` only in the correct environment.
