# Eliminate Manual Prisma Types

**Goal:** Zero manual Prisma type declarations across the codebase. All types derived from the
Prisma-generated client (`@prisma/client` → `prisma/generated/client/`).

## Why

Manual type declarations that mirror Prisma models are:

- **Drift-prone** — schema changes silently desync the manual type. No compiler error, only
  runtime surprises.
- **Test-brittle** — mocks built around manual types don't catch real model changes. Tests pass
  against stale shapes.
- **Cognitive overhead** — every `as unknown as SomeManualDelegate` cast erases TypeScript's
  ability to help.
- **Boilerplate** — Prisma already generates every type we need. Re-declaring it is pure waste.

## Strategy: DTO Derivation (not duplication)

The principle: **import, don't declare.** Every shape should be derived from a Prisma-generated
type, never hand-written.

## DTO Boundary Standard

DTO hanya WAJIB di API boundary (route handler → client). Internal layer pake Prisma types langsung.

### Layer decision matrix

| Layer | Pakai DTO? | Kenapa |
|-------|-----------|--------|
| Route handler → Client | ✅ **WAJIB** | API contract, security, stability |
| Service → Service (satu module) | ❌ Tidak | Boilerplate tanpa value |
| Service → Service (beda module) | ⚠️ Tergantung | Decoupling value vs overhead |
| Repository → Service | ❌ Tidak | Prisma types langsung, KISS |

### Implementasi: `*.dto.ts` + `toDTO` per module

```ts
// modules/invoices/invoices.dto.ts
import { Prisma } from "@prisma/client"

export type InvoiceDTO = Pick<
  Prisma.InvoiceGetPayload<{}>,
  "id" | "invoiceNumber" | "totalAmount" | "status"
>

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

### Pattern 1: Pick fields for API responses

```ts
// ❌ Manual — duplicates model fields, rots on schema change
type InvoiceListItem = {
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
}

// ✅ Derived — compiler catches field renames / deletions
import type { Prisma } from "@prisma/client"
type InvoiceListItem = Pick<
  Prisma.InvoiceGetPayload<{}>,
  "id" | "invoiceNumber" | "totalAmount" | "status"
>

// For re-use across files, name it clearly:
type InvoiceSummary = Pick<Prisma.InvoiceGetPayload<{}>, "id" | "invoiceNumber" | "totalAmount">
```

### Pattern 2: Include relations

```ts
// ❌ Manual
type InvoiceWithLines = {
  id: string
  lines: Array<{ id: string; description: string; amount: number }>
}

// ✅ Derived directly from a Prisma include
const invoiceWithLinesInclude = {
  lines: { select: { id: true, description: true, amount: true } },
} satisfies Prisma.InvoiceInclude

type InvoiceWithLines = Prisma.InvoiceGetPayload<{
  include: typeof invoiceWithLinesInclude
}>

// The include object is re-usable in actual queries too — single source of truth.
```

### Pattern 3: `satisfies` instead of manual delegate types

```ts
// ❌ Manual delegate — hand-written method signatures
type InvoiceDelegate = {
  findMany: (args: {...}) => Promise<InvoiceRecord[]>
  findFirst: (args: {...}) => Promise<InvoiceRecord | null>
}

// ✅ Just use prisma directly. If you need a constrained interface:
type InvoiceDelegate = Pick<PrismaClient["invoice"], "findMany" | "findFirst">
// Now `findMany` and `findFirst` have the exact generated signatures.
```

### Pattern 4: Use `Prisma` namespace for query args

```ts
// ❌ Record<string, unknown> — zero type safety
const where: Record<string, unknown> = { status: "OPEN" }

// ✅ Prisma.ModelWhereInput — full auto-complete + type checking
const where: Prisma.InvoiceWhereInput = { status: "OPEN" }

// For dynamic construction:
const where: Prisma.InvoiceWhereInput = {}
if (filter.status) where.status = filter.status
if (filter.dateFrom) where.createdAt = { gte: filter.dateFrom }
```

### Pattern 5: Re-export Prisma enums

```ts
// ❌ Manual string union — duplicates enum, no compile-time safety
type ServiceType = "APP_HOSTING" | "VPN" | "WHATSAPP"

// ✅ Import and re-export if you need to narrow the import path
import type { ServiceType } from "@prisma/client"
// OR re-export from module boundary:
export type { ServiceType } from "@prisma/client"
```

### Pattern 6: Derive config objects from enums

```ts
// ❌ Manual array + type that duplicates Prisma enum
const SERVICE_TYPES = ["APP_HOSTING", "VPN", "WHATSAPP"] as const
type ServiceType = (typeof SERVICE_TYPES)[number]

// ✅ Derive from Prisma enum
import type { ServiceType } from "@prisma/client"

// For zod schemas, derive from Prisma enums:
import { z } from "zod"
const serviceTypeSchema = z.nativeEnum(import("prisma/generated/client").ServiceType)
// ^^^ check runtime import availability
```

### Pattern 7: Transaction / batch types

```ts
// ❌ Manual tx wrapper type
type GithubPrismaTx = {
  githubInstallation: { upsert: (args: {...}) => Promise<...> }
  githubRepositoryConnection: { upsert: (args: {...}) => Promise<...> }
}

// ✅ Use Prisma's built-in transaction client
// Prisma.$transaction async callback already receives `tx: PrismaTransactionClient`
// which has full type info for every model.
await prisma.$transaction(async (tx) => {
  // tx.githubInstallation.upsert(...) ← fully typed
  // tx.githubRepositoryConnection.upsert(...) ← fully typed
})
```

## When manual types ARE acceptable

1. **External API payloads** (Meta Cloud API shapes, webhook event shapes from third parties)
   — these are not Prisma models, they're external contracts.
2. **Computed / aggregated shapes** — data that doesn't exist in the DB at all
   (e.g. `type DashboardStats = { totalRevenue: number; activeUsers: number }`).
3. **View-specific UI state** — component-local types that transform domain data for
   rendering (e.g. `type TableSort = { column: string; direction: "asc" | "desc" }`).

## Phased Plan

### Phase 1 — Low-hanging fruit (1-2 PRs)

Enums and simple Pick/Omit replacements:

| File | What | Effort |
|------|------|--------|
| `modules/billing/plans.ts` | Replace manual enum unions with imports | 5 min |
| `modules/whatsapp/whatsapp-client.ts` | Replace `type DeviceStatus = "..."` with imports | 10 min |
| `modules/whatsapp/devices/devices.schemas.ts` | Use `z.nativeEnum()` with Prisma enums | 5 min |
| `lib/billing-client.ts` | Replace manual model shapes with `Pick<Prisma.Model...>` | 10 min |

### Phase 2 — Hot files (2-3 PRs)

Files with manual delegates, casts, and full model re-declarations:

| File | What | Effort | Risk |
|------|------|--------|------|
| `modules/invoices/invoices.repository.ts` | Replace full manual delegate + record types with generated types | 30 min | Medium (query patterns) |
| `modules/invoices/invoices.service.ts` | Remove duplicate manual enum | 5 min | Low |
| `modules/invoices/invoices.types.ts` | Replace manual shapes with `Pick<...>` | 10 min | Low |
| `modules/github/github-install-state.ts` | Remove manual store type, use prisma directly | 20 min | Medium |
| `modules/github/github.webhook.ts` | Remove manual store types + casts | 30 min | Medium |
| `modules/github/github.service.ts` | Remove manual tx types, use `$transaction` callback types | 20 min | Medium |

### Phase 3 — Large refactors (2-3 PRs)

Modules where the types ARE the API contract:

| File | What | Effort | Risk |
|------|------|--------|------|
| `modules/whatsapp/whatsapp-client.ts` | Replace all 10+ model types with derived types | 45 min | High (API surface) |
| `modules/whatsapp/devices/devices.service.ts` | Replace `PrismaDeviceFields` with generated types | 10 min | Low |
| `modules/support-tickets/support-ticket.types.ts` | Replace manual model types with derived types | 15 min | Low |
| `modules/billing/types.ts` | Replace `PricingLookup` with `Pick<...>` | 5 min | Low |
| `modules/payment/services/bank-account.service.ts` | Replace `Record<string, unknown>` with proper types | 10 min | Low |
| `modules/payment/services/gateway.service.ts` | Replace `Record<string, unknown>` with proper types | 10 min | Low |

### Phase 4 — Test cleanup (parallel with above)

| File | What | Effort |
|------|------|--------|
| `test/helpers/prisma-mock.ts` | Use `Partial<PrismaClient>` instead of `as any` | 15 min |
| Various `*.test.ts` files | Remove `as any` casts for Prisma mocks once models use real types | Ongoing |

## How to verify a file is clean

1. Search for `as unknown as` — every cast on `prisma` is a red flag.
2. Search for `Record<string, unknown>` used as a Prisma query arg.
3. Search for `type.*=.*\{.*id.*:.*string` — are you re-declaring a model shape?
4. Check the import: does this file import its types from `@prisma/client`?

If the answer to any of 1-3 is "yes" and 4 is "no", the file needs refactoring.

## Refs

- ~~PR #160~~ (will be merged) — adds alias, fixes `platform-role.ts`, enforces rule in
  AGENTS.md / CLAUDE.md
- Generated types at `prisma/generated/client/index.d.ts` — inspect this file to see what's
  available before writing a manual type
