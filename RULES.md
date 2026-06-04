# Detailed Implementation Rules

> **Read this file only during implementation work** (writing code, fixing bugs, adding tests, opening PRs).
> **Skip this file during planning, spec writing, design, or brainstorming sessions.**

---

## Prisma Types: Always Use Generated Types (HARD REQUIREMENT)

All Prisma types must come from the generated client (`@prisma/client` — resolves via `node_modules/.prisma/client/`). NEVER declare manual types that mirror Prisma models.

### DO ✅
```ts
import { Prisma, PrismaClient } from "@prisma/client"
import type { PlatformUserRole, InvoiceStatus } from "@prisma/client"

// Use Prisma namespace for query arg types
const where: Prisma.InvoiceWhereInput = { status: "OPEN" }

// Direct model access — full type safety
const record = await prisma.platformUserRole.findFirst({ where: { workosUserId } })
```

### DON'T ❌
```ts
// Manual model type — duplicates Prisma, rots over time
type InvoiceRecord = { id: string; status: string; totalAmount: number }

// Manual delegate type — bypasses Prisma's generated types entirely
type InvoiceDelegate = { findMany: (args: {...}) => Promise<InvoiceRecord[]> }

// Manual enum — duplicates Prisma enum, string comparison risks
type PrismaInvoiceStatus = "DRAFT" | "OPEN" | "PAID"

// `as unknown as` cast on prisma — discards all type safety
const delegate = (prisma as unknown as { invoice?: InvoiceDelegate }).invoice

// `Record<string, unknown>` for Prisma query args — loses type safety
const where: Record<string, unknown> = {}
```

---

## DTO Layer: Boundary Contract, Not Duplication (HARD REQUIREMENT)

Every API response must go through an explicit DTO. Internal service-to-service calls use Prisma types directly.

### The rule by layer

| Layer | Type | Rule |
|-------|------|------|
| Route handler → Client | **DTO** (derived) | **WAJIB** — API contract, security, stability |
| Service → Service (same module) | Prisma types | ❌ Jangan bikin DTO — boilerplate tanpa value |
| Service → Service (cross-module) | DTO or Prisma types | ⚠️ DTO disarankan kalo beda domain |
| Repository/Prisma → Service | Prisma types | ❌ Pakai Prisma langsung — KISS |
| Serialization / Display | **DTO** (derived) | ✅ Format transform, tanggal, currency |

### Pattern: `*.dto.ts` + `toDTO` helper per module

```ts
// modules/invoices/invoices.dto.ts
import { Prisma } from "@prisma/client"

// DTO — explicit, stable contract untuk client
export type InvoiceDTO = Pick<
  Prisma.InvoiceGetPayload<{}>,
  "id" | "invoiceNumber" | "totalAmount" | "status"
>

export type InvoiceDetailDTO = InvoiceDTO & {
  lines: Array<Pick<Prisma.InvoiceLineGetPayload<{}>, "description" | "amount">>
}

// Mapping function — testable, explicit
export function toInvoiceDTO(
  invoice: Prisma.InvoiceGetPayload<{}>
): InvoiceDTO {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
  }
}
```

```ts
// modules/invoices/api/invoices.route.ts
import { toInvoiceDTO, type InvoiceDTO } from "../invoices.dto"

router.get("/invoices", async (ctx) => {
  const invoices = await invoiceService.list(orgId)
  return invoices.map(toInvoiceDTO)  // ✅ DTO di boundary
})
```

### Internal service — Prisma types langsung

```ts
// modules/invoices/invoices.service.ts
// ❌ JANGAN bikin DTO untuk internal
async function calculateTax(
  invoice: Prisma.InvoiceGetPayload<{ include: { lines: true } }>
): Promise<Decimal> {
  // ✅ Pakai Prisma types langsung — fully typed
  return invoice.lines.reduce((sum, line) => sum.add(line.amount), new Decimal(0))
}
```

### Kenapa DTO di boundary?
- **Stable contract** — rename kolom DB gak nge-break API client
- **Security** — accidental expose `internalNotesJson` gak bakal terjadi
- **Over-fetching** — Prisma `select` jadi jelas karena DTO yang menentukan
- **Testable** — mapping function bisa di-UT sendiri

---

## Fixing Existing Violations

When touching a file with manual Prisma types, refactor them to use generated types. Common refactors:

1. **Manual `foo.service.ts`** → import `PrismaClient` from `@prisma/client`, use generated model names and `Prisma.ModelWhereInput` etc.
2. **Manual store/delegate** → delete the type, pass `prisma` directly (or use `Pick` on generated `PrismaClient` if mocking is needed)
3. **Manual enums** → import the enum from `@prisma/client`
4. **Response from route handler** → create `*.dto.ts` with `Pick<Prisma.ModelGetPayload<{}>, ...>` and a `toDTO` mapper

---

## Console Surface Consistency

- Keep all pages under `app/[lang]/console/**` visually consistent with the console overview page structure.
- Use `main` wrapper class `flex flex-1 flex-col gap-6 p-6 pt-0` for content pages unless a parent layout already provides the same spacing contract.
- Use shared table primitives and the shared TanStack table pattern for tabular data so sorting, filtering, and column visibility behavior remains consistent between console pages.
- Avoid one-off page-specific spacing/layout patterns for invoices, support tickets, and other console subpages unless explicitly required by product design.

---

## Testing Guidelines

- Test runner: `bun test` (`bunfig.toml` preloads `test/setup.ts`).
- UI tests use Testing Library with Happy DOM and `@testing-library/jest-dom` matchers.
- Keep tests close to source files (examples: `modules/docs/docs.service.test.ts`, `components/nav-main.test.tsx`).
- Add or update tests for new behavior in API routes, tenant policy logic, and rendered UI states.

### Bun `mock.module` — Module Cache Rules (CRITICAL)

Bun runs test files in **parallel isolated workers** locally but in a **single shared process** under `--coverage` (used by CI). This means `mock.module()` calls are **permanent within a CI run** — a module replaced in one file remains replaced for every file that runs after it.

**The golden rule: never call `mock.module()` on a module that another test file tests directly.**

#### Correct mock layering strategy

Mock at the **lowest shared dependency** (infrastructure), not at intermediate service boundaries:

```
❌ WRONG — messages.service.test.ts mocks quota.service
   → quota.service.test.ts then receives the mock, not the real implementation

✅ CORRECT — messages.service.test.ts mocks @/lib/prisma
   → both test files share the same prisma mock layer
   → quota.service.test.ts still gets the real quota service
```

#### Concrete rules

1. **Mock leaf dependencies only** — mock external infrastructure (`@/lib/prisma`, `@/lib/queue/*`, `@/lib/whatsapp/*`, third-party SDKs). Never mock a sibling service module that has its own `*.test.ts` file.

2. **One test file owns each module** — the file named `foo.service.test.ts` is the sole owner of `foo.service`'s behaviour. All other test files must treat `foo.service` as a black box controlled via shared infrastructure mocks (e.g., prisma).

3. **`mock.module` calls go at the very top** — place all `mock.module()` calls before any `import` or `await import()` statements so Bun registers them before module evaluation. Pattern:
   ```ts
   import { mock } from "bun:test"
   // 1. define mock objects
   const mockPrisma = { ... }
   // 2. register module mocks
   mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
   // 3. only then import the thing under test
   const { myService } = await import("./my.service")
   ```

4. **Use `mockClear()` in `beforeEach`, not `mockReset()`** — `mockReset()` removes the implementation; re-set defaults explicitly in `beforeEach` using `mockResolvedValue` / `mockImplementation` to avoid undefined leaking between tests.

5. **No duplicate test blocks across files** — if `quota.service.test.ts` already covers `checkQuota`, do not add a `describe("quotaService")` block in `messages.test.ts`. Duplicate coverage causes ordering-sensitive failures and inflates the test count.

6. **Validate with `bun run test:coverage` before every PR** — coverage runs in a single process (same as CI), so it will surface cross-file pollution that `bun test` misses locally.

---

## E2E Test Scripts

Real-use-case scripts that exercise the API auth flows against a running dev server (`bun run dev` on `:3300`). These are NOT unit tests — they require a live server and, for the cookie test, a browser session.

| Script | What it tests | Prerequisites |
|---|---|---|
| `bun run test:auth:cookie` | Cookie-based auth (`wos-session`) against `/api/auth/whoami` and `/api/whatsapp/devices` | `bun run dev` running; `WOS_SESSION_COOKIE` env var set (copy from browser DevTools: Application > Cookies > wos-session) |
| `bun run test:auth:static-key` | Static API key auth (`Authorization: Bearer test_xxx`) against the same endpoints; creates + cleans up a key via Prisma | `bun run dev` running; `DATABASE_URL` + `ORGANIZATION_ID` env vars set |
| `bun run create:api-key` | Issues a new API key and prints the raw value to stdout once | `DATABASE_URL` env var set |

**Important:** These scripts hit the real server. They are not suitable for CI until a dev-server harness is added.

---

## Commit & Pull Request Guidelines

- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `test: ...`, `chore: ...`, `docs: ...`.
- Use imperative, scoped summaries (example: `feat: add onboarding flow page`).
- When opening PRs with GitHub CLI, write the body to a Markdown file and use `gh pr create --body-file <file>` to preserve newlines reliably; avoid inline `--body` for multiline text.
- PRs should include: problem/solution summary, linked issue (if available), test evidence (`bun run test`, `bun run lint`), and screenshots for UI changes.

---

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

---

## Security & Configuration Tips

- Copy required values from `.env.example`; never commit real secrets.
- Required integrations include PostgreSQL (`DATABASE_URL`) and WorkOS keys.
- Run role/bootstrap scripts via `bun run seed:workos-roles` and `bun run grant:super-admin` only in the correct environment.
