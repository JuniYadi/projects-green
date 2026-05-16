# Repository Guidelines

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
- `npm run dev`: Start local dev server on `http://localhost:3300`.
- `npm run build`: Production build.
- `npm run start`: Run built app.
- `npm run lint`: Run ESLint (Next core-web-vitals + TypeScript rules).
- `npm run typecheck`: TypeScript checks without emit.
- `npm run test`: Run Bun tests.
- `npm run test:coverage`: Run tests with text + lcov output in `coverage/`.
- `npm run prisma:migrate:dev` / `npm run prisma:generate`: Apply DB migrations and refresh Prisma client.

## Coding Style & Naming Conventions
- TypeScript-first; strict mode is enabled in `tsconfig.json`.
- Prettier rules: 2-space indent, no semicolons, double quotes, 80-char line width.
- Use path alias `@/*` for internal imports.
- Name feature files by concern (`*.service.ts`, `*.route.ts`, `*.policy.ts`) and tests as `*.test.ts` / `*.test.tsx`.

## Testing Guidelines
- Test runner: `bun test` (`bunfig.toml` preloads `test/setup.ts`).
- UI tests use Testing Library with Happy DOM and `@testing-library/jest-dom` matchers.
- Keep tests close to source files (examples: `modules/docs/docs.service.test.ts`, `components/nav-main.test.tsx`).
- Add or update tests for new behavior in API routes, tenant policy logic, and rendered UI states.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `test: ...`, `chore: ...`, `docs: ...`.
- Use imperative, scoped summaries (example: `feat: add onboarding flow page`).
- PRs should include: problem/solution summary, linked issue (if available), test evidence (`npm run test`, `npm run lint`), and screenshots for UI changes.

## Security & Configuration Tips
- Copy required values from `.env.example`; never commit real secrets.
- Required integrations include PostgreSQL (`DATABASE_URL`) and WorkOS keys.
- Run role/bootstrap scripts via `npm run seed:workos-roles` and `npm run grant:super-admin` only in the correct environment.
