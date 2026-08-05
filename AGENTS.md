# Repository Guidelines

## Agent boot order

1. Read this file for repo-local non-negotiables.
2. Read repo-root `.obsidian.json` (at `{repo-root}/.obsidian.json`, NOT anywhere else). Extract `directory` and `entry`. Then run `bun run obsidian:boot` — before any parallel reads — and use `skill://obsidian-load` to follow the entry note's Agent flow.
3. Read notes by logical name: `bun run obsidian:read -- "Note Name"` or `bun run obsidian:resolve -- "Note Name"`. Never construct filesystem paths from wikilinks; never use grep/find for note resolution. For `obsidian://open?vault=<name>&file=<path>` URLs (explicit vault-relative paths, not logical names), use `skill://obsidian-resolve` first, then `skill://obsidian-load`.

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

## graphify (optional)

If `graphify` is installed:
- When the user types `/graphify`, use the installed graphify skill. If no graph exists yet, let the skill build one.

If `graphify` is installed and `graphify-out/graph.json` exists:
- For codebase questions, first run `graphify query "<question>"`. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
