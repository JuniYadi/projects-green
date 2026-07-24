# Repository Guidelines

## Agent boot order

1. Read this file for repo-local non-negotiables.
2. Read the vault home page first: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Welcome.md`.
3. In the vault, follow `Welcome.md`'s Agent entry flow: `[[SESSION-BRIEFING]]`, `[[index]]`, recent `[[log]]`, `[[SCHEMA]]`, matching skill notes, then the relevant project hub.
4. If the vault is unavailable, continue with this file plus the task prompt; mark vault-backed claims as unverified instead of inventing docs.

## Local hard rules

- Use `bun` for project commands. Do not use `npm` or `yarn`.
- Never run destructive Prisma commands: `bunx prisma migrate reset*`, `bunx prisma db push --force-reset`, `bunx prisma db push --accept-data-loss`, `prisma migrate reset*`, `prisma db push --force-reset`, or `prisma db push --accept-data-loss`.
- Safe Prisma commands: `bun run prisma:migrate:dev` and `bun run prisma:generate`.
- Before PR, run change-scoped 3 pillars: `bun run lint`, `bun run typecheck`, `bun run test`. Fix only regressions in changed files/modules.
- TypeScript style: strict types, 2-space indent, no semicolons, double quotes, 80-char line width, `@/*` imports.
- Prisma types must come from `@prisma/client`; do not declare manual model, delegate, or enum mirror types. Refactor touched violations.
- API responses must use explicit DTOs (`*.dto.ts` plus `toDTO` mapper). Internal service-to-service calls use Prisma types directly.
- WorkOS user/org names must resolve through `lib/workos-directory.ts`; do not use deprecated WorkOS cache/sidebar hooks.
- Bun tests: mock leaf infrastructure only, put `mock.module()` before imports, use `mockClear()` plus explicit defaults in `beforeEach`, and run `bun run test:coverage` if mock setup changes.
- Console pages under `app/[lang]/console/**` use the shared console spacing (`flex flex-1 flex-col gap-6 p-6 pt-0`) and shared table patterns unless product design requires otherwise.
- Vault docs are the product/domain source of truth. If vault docs conflict with code, update code or flag the mismatch; do not duplicate domain docs in the repo.

## Project map

- `app/`: Next.js App Router pages, layouts, route handlers.
- `modules/`: feature slices with API, service, policy, and UI code.
- `components/`: shared UI/layout primitives.
- `lib/`: shared utilities, platform helpers, Prisma/API clients.
- `prisma/`: schema and migrations.
- `test/`: Bun test setup.
- `scripts/`: operational scripts.