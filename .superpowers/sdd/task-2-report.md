# Task 2 — Durable admin catalog contracts and persistence

## Delivered

- Added `ProductState` (`DRAFT | PUBLISHED | PAUSED | ARCHIVED`) to `ServicePackage`.
- Added additive migration `prisma/migrations/20260808120000_add_product_state/migration.sql`. It adds the enum/column with a temporary `DRAFT` default, then backfills legacy active packages to `PUBLISHED` and legacy inactive packages to `ARCHIVED`; no historical migration was edited and no reset was attempted.
- Added explicit admin DTOs and `toAdminCatalogPriceDTO`, `toAdminCatalogPlanDTO`, and `toAdminCatalogProductDTO` mappers in `modules/billing/catalog/admin-catalog.dto.ts`.
- Added transaction-backed `AdminCatalogService` for list/detail, draft save, and publish validation. Draft writes use `ServicePackage`, `ServicePlan`, and `ServicePricing`; every price resolves the `GLOBAL` region explicitly, retains supplied effective dates, and writes the explicit amount without `CurrencyService.convert()`.
- Added super-admin Elysia routes:
  - `GET /billing/admin/catalog`
  - `GET /billing/admin/catalog/:code`
  - `POST /billing/admin/catalog`
  - `PATCH /billing/admin/catalog/:code`
  - `POST /billing/admin/catalog/:code/publish`
- Registered admin routes in `modules/billing/api/index.ts`. A direct Eden route inspection showed all five admin paths plus existing customer catalog paths.
- Customer catalog list/detail queries now require both `isActive: true` and `state: "PUBLISHED"`, preserving active/inactive legacy filtering.

## Contract callsites / LSP

I attempted `typescript-language-server --stdio` `textDocument/references` from the absolute linked-worktree root for `CatalogService` and `CatalogProductDTO`; the server did not return before the 30-second tool deadline. I therefore recorded the affected references with the repository search fallback before changing contracts:

- `CatalogService`: `modules/billing/api/catalog.route.ts` default dependency and service method contract; `modules/billing/catalog/catalog.service.test.ts` direct construction.
- `CatalogProductDTO` / list/detail DTOs: `modules/billing/catalog/catalog.dto.ts`, `modules/billing/api/catalog.route.ts`, customer UI consumers through `lib/billing-client.ts` (left untouched per assignment), and catalog DTO tests.
- `createCatalogRoutes` / `billingRoutes`: `modules/billing/api/catalog.route.ts`, `modules/billing/api/catalog.route.test.ts`, and `modules/billing/api/index.ts`.
- New admin symbols are consumed by `modules/billing/api/admin/catalog.route.ts` and its focused tests; the route is mounted from `modules/billing/api/index.ts`.

No portal/console pages, sidebar, `lib/billing-client.ts`, or `lib/billing-queries.ts` were changed.

## TDD evidence

RED was observed before implementation:

- Service test: `bun test --preload test/setup.ts /home/juniyadi/github/JuniYadi/projects-green/.worktrees/global-billing-ui-parity/modules/billing/catalog/admin-catalog.service.test.ts` → `Cannot find module './admin-catalog.service'` (0 pass, 1 fail).
- Route test: same command for `modules/billing/api/admin/catalog.route.test.ts` → `Cannot find module './catalog.route'` (0 pass, 1 fail).

Focused GREEN evidence after implementation (with command-scoped dummy `DATABASE_URL`, never written to config):

- `DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy bun test --preload test/setup.ts .../admin-catalog.service.test.ts .../admin/catalog.route.test.ts .../catalog.service.test.ts` → **11 pass, 0 fail** (32 expectations).
- The service tests cover draft list/detail DTOs, transaction/GLOBAL writes, incomplete/missing/zero/negative enabled cells, and successful publish transition.
- The admin route tests cover super-admin denial, DTO list/detail shape, draft save, publish transition, not found, and validation error mapping.

The existing customer route test file emits the repository's terse `DB_ERROR`/`SERVICE_ERROR` output under both preloaded and direct focused invocation; the customer service lifecycle suite is green and the failure is in the pre-existing route test infrastructure/mock path, not the changed catalog service query. This was not expanded into unrelated infrastructure work.

## Prisma evidence

- `DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy bun run db:generate` → Prisma Client v7.9.1 generated successfully.
- `DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy bun --bun prisma validate` → schema valid.
- `bun run db:migrate:dev -- --name add_product_state` was attempted without database configuration and failed exactly at Prisma config loading: `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`. No destructive workaround or reset was attempted; the approved additive migration was created manually using the local SQL convention.

## Commit and workspace proof

- Focused commit: `f30bb180` (`feat(billing): add admin catalog lifecycle API`).
- Main checkout `/home/juniyadi/github/JuniYadi/projects-green` was verified clean after correcting an initial path-targeting issue.
- Linked worktree contains only the committed Task 2 diff and this report.

## Concerns

- The repository's existing customer catalog route test still reports terse `DB_ERROR`/`SERVICE_ERROR` under focused execution; aggregate infrastructure failures were explicitly out of scope.
- `ServicePricing.basePriceIdr` is a required legacy compatibility column. Draft writes set it to the explicit submitted amount while preserving the canonical per-currency `periodPrice`; no currency conversion is performed.
