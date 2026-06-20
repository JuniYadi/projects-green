# Multi-Currency VPN Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable cross-currency VPN package purchases by converting prices via `CurrencyService` and locking converted amounts in subscriptions.

**Architecture:** Add 3 audit columns to `VpnSubscription` (`originalPrice`, `originalCurrency`, `exchangeRate`). Inject `CurrencyService` into `VpnSubscriptionService.purchase()` to convert USD→IDR (or vice versa) before charging. Update public DTOs to include converted prices for UI display. Replace hardcoded `IDR_USD_FIXED_RATE` in legacy route with dynamic `CurrencyService` rates.

**Tech Stack:** Prisma (schema + migration), TypeScript, Elysia routes, CurrencyService (existing), bun test

## Global Constraints

- Base currency is USD (hardcoded in `PaymentCurrency` table, `isBase: true`, `ratePerBase: 1`)
- Exchange rates stored as units of target currency per 1 USD (e.g. IDR = 16000)
- All financial math uses `Prisma.Decimal` (no floating point)
- CurrencyService.convert() converts via base: `amount / rate(from) * rate(to)`
- `debitServiceBalance()` throws `CURRENCY_MISMATCH` if `input.currency !== account.currency`
- Validation: Prettier 2-space indent, no semicolons, double quotes, 80-char width
- Tests: `bun test`, co-located `*.test.ts`, mock-based (no DB in unit tests)

---

### Task 1: Add audit columns to `VpnSubscription`

**Files:**
- Modify: `prisma/schema.prisma` (line ~1262)
- Create: `prisma/migrations/YYYYMMDDHHMMSS-add_vpn_subscription_currency_audit/migration.sql`

**Interfaces:**
- Consumes: None (schema-only change)
- Produces: `VpnSubscription.originalPrice`, `VpnSubscription.originalCurrency`, `VpnSubscription.exchangeRate` fields available for later tasks

- [ ] **Step 1: Add 3 columns to VpnSubscription model in schema.prisma**

In `prisma/schema.prisma`, after the `currency` field (line ~1263), add:

```prisma
  // Original package price at purchase time (before any currency conversion).
  // Null for subscriptions created before multi-currency support.
  originalPrice    Decimal?              @db.Decimal(12, 2)
  originalCurrency String?
  // Exchange rate used at purchase time (units of originalCurrency per 1 base unit).
  exchangeRate     Decimal?              @db.Decimal(18, 6)
```

- [ ] **Step 2: Generate migration**

Run: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/projects_green" bunx prisma migrate dev --name add_vpn_subscription_currency_audit`

Expected: Migration file created in `prisma/migrations/`

- [ ] **Step 3: Backfill existing subscriptions**

Add a data migration SQL to the generated migration file, before the `ALTER TABLE`:

```sql
-- Backfill existing subscriptions: original = locked (same currency, no conversion)
UPDATE "VpnSubscription"
SET
  "originalPrice" = "priceLocked",
  "originalCurrency" = "currency",
  "exchangeRate" = 1
WHERE "originalPrice" IS NULL;
```

- [ ] **Step 4: Run migration**

Run: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/projects_green" bunx prisma migrate dev`

Expected: Migration applies successfully

- [ ] **Step 5: Regenerate Prisma client**

Run: `bun run prisma:generate`

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(vpn): add originalPrice, originalCurrency, exchangeRate to VpnSubscription"
```

---

### Task 2: Add `VpnCurrencyNotSupportedError` and inject `CurrencyService` into `VpnSubscriptionService`

**Files:**
- Modify: `modules/vpn/subscriptions/vpn-subscription.service.ts`
- Test: `modules/vpn/subscriptions/vpn-subscription.service.test.ts`

**Interfaces:**
- Consumes: `CurrencyService.convert(amount, from, to)` from `@/modules/billing/currency.service`
- Produces: `VpnCurrencyNotSupportedError` error class, updated `VpnSubscriptionService` constructor accepting optional `CurrencyService`

- [ ] **Step 1: Write failing test for currency conversion**

In `modules/vpn/subscriptions/vpn-subscription.service.test.ts`, add after the existing `describe("VpnSubscriptionService.purchase")` block:

```typescript
describe("VpnSubscriptionService.purchase — cross-currency", () => {
  it("converts USD package price to IDR billing currency", async () => {
    // USD package: 0.50 USD, IDR billing account at rate 16000
    const usdPackage = {
      ...activePackage,
      price: decimal("0.50"),
      currency: "USD",
    }
    pkgFindUnique.mockResolvedValue(usdPackage)

    // Mock CurrencyService: 0.50 USD → 8000 IDR
    const mockCurrencyService = {
      convert: mock(async () => decimal("8000")),
      getByCode: mock(async (code: string) => ({
        code,
        ratePerBase: decimal(code === "USD" ? "1" : "16000"),
      })),
    }

    const svc = new VpnSubscriptionService(prismaMock, {
      transactions,
      dispatch,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currency: mockCurrencyService as any,
    })

    await svc.purchase({ organizationId: "org-1", packageId: "pkg-1" })

    // Should debit in IDR (account currency), not USD
    const debitArgs = debitServiceBalance.mock.calls[0][0]
    expect(debitArgs.currency).toBe("IDR")
    expect(debitArgs.amount.toString()).toBe("8000")

    // Subscription should lock IDR price, store original USD
    const createArgs = subCreate.mock.calls[0][0].data
    expect(createArgs.priceLocked.toString()).toBe("8000")
    expect(createArgs.currency).toBe("IDR")
    expect(createArgs.originalPrice.toString()).toBe("0.50")
    expect(createArgs.originalCurrency).toBe("USD")
    expect(createArgs.exchangeRate.toString()).toBe("16000")
  })

  it("same currency skips conversion", async () => {
    // IDR package, IDR billing account — no conversion needed
    const mockCurrencyService = {
      convert: mock(async () => decimal("100000")),
      getByCode: mock(async (code: string) => ({
        code,
        ratePerBase: decimal(code === "USD" ? "1" : "16000"),
      })),
    }

    const svc = new VpnSubscriptionService(prismaMock, {
      transactions,
      dispatch,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currency: mockCurrencyService as any,
    })

    await svc.purchase({ organizationId: "org-1", packageId: "pkg-1" })

    // Should NOT call convert (same currency)
    expect(mockCurrencyService.convert).not.toHaveBeenCalled()

    // Subscription stores original = locked
    const createArgs = subCreate.mock.calls[0][0].data
    expect(createArgs.originalPrice.toString()).toBe("100000")
    expect(createArgs.originalCurrency).toBe("IDR")
    expect(createArgs.exchangeRate.toString()).toBe("1")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test modules/vpn/subscriptions/vpn-subscription.service.test.ts`

Expected: FAIL — `currency` option doesn't exist in constructor, `originalPrice`/`originalCurrency`/`exchangeRate` not in create data

- [ ] **Step 3: Implement currency conversion in VpnSubscriptionService**

In `modules/vpn/subscriptions/vpn-subscription.service.ts`:

Add import at top:
```typescript
import {
  CurrencyService,
  CurrencyNotFoundError,
} from "@/modules/billing/currency.service"
```

Add `VpnCurrencyNotSupportedError` after `VpnBillingAccountNotFoundError`:
```typescript
export class VpnCurrencyNotSupportedError extends Error {
  constructor(message = "Currency conversion is not supported for this combination.") {
    super(message)
    this.name = "VpnCurrencyNotSupportedError"
  }
}
```

Update constructor to accept optional `currency` option:
```typescript
  private readonly currency: CurrencyService

  constructor(
    prisma: PrismaLike = defaultPrisma,
    options: {
      transactions?: BillingTransactionService
      dispatch?: ProvisioningDispatcher
      currency?: CurrencyService
    } = {}
  ) {
    this.prisma = prisma
    this.transactions =
      options.transactions ?? new BillingTransactionService(prisma)
    this.dispatch = options.dispatch ?? (async () => {})
    this.currency = options.currency ?? new CurrencyService(prisma)
  }
```

Update `purchase()` method. After computing `chargeAmount` (line ~191), add currency conversion logic:

```typescript
    // ── Currency conversion ────────────────────────────────────────
    // Fetch billing account to determine the charge currency.
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) {
      throw new VpnBillingAccountNotFoundError()
    }
    const accountCurrency = account.currency

    let chargePrice: Prisma.Decimal
    let exchangeRate: Prisma.Decimal

    if (pkg.currency === accountCurrency) {
      // Same currency — no conversion needed.
      chargePrice = chargeAmount
      exchangeRate = new Prisma.Decimal(1)
    } else {
      // Cross-currency — convert package price to billing account currency.
      try {
        chargePrice = await this.currency.convert(
          chargeAmount,
          pkg.currency,
          accountCurrency
        )
        // Compute exchange rate: units of accountCurrency per 1 unit of pkgCurrency
        const fromRate = await this.currency.getRate(pkg.currency)
        const toRate = await this.currency.getRate(accountCurrency)
        exchangeRate = toRate.div(fromRate)
      } catch (error) {
        if (
          error instanceof CurrencyNotFoundError ||
          (error instanceof Error && error.name === "CurrencyNotFoundError")
        ) {
          throw new VpnCurrencyNotSupportedError(
            `Cannot convert from ${pkg.currency} to ${accountCurrency}. Currency not supported.`
          )
        }
        throw error
      }
    }
```

Update the `debitServiceBalance` call to use `accountCurrency` instead of `pkg.currency`:
```typescript
      await this.transactions.debitServiceBalance({
        organizationId: input.organizationId,
        amount: chargePrice,
        currency: accountCurrency,  // ← was pkg.currency
        source: "VPN",
        // ... rest unchanged
      })
```

Update the subscription `create` data to include audit fields:
```typescript
    const subscription = await this.prisma.vpnSubscription.create({
      data: {
        organizationId: input.organizationId,
        packageId: input.packageId,
        status: "SUSPENDED",
        priceLocked: chargePrice,         // ← was pkg.price
        currency: accountCurrency,        // ← was pkg.currency
        originalPrice: pkg.price,         // NEW
        originalCurrency: pkg.currency,   // NEW
        exchangeRate: exchangeRate,       // NEW
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        serverAccounts: { /* unchanged */ },
      },
      include: subscriptionInclude,
    })
```

Update the invoice line `unitPrice` to use `chargePrice` (the converted amount):
```typescript
        line: {
          description: isFullMonth
            ? `VPN package "${pkg.name}" — ${period}`
            : `VPN package "${pkg.name}" — ${daysRemaining}/${daysInMonth} month (${period})`,
          quantity: chargeQuantity,
          unitPrice: chargePrice,   // ← was pkg.price (use converted price for invoice)
          lineType: "SUBSCRIPTION",
          category: "vpn",
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test modules/vpn/subscriptions/vpn-subscription.service.test.ts`

Expected: All tests pass including the new cross-currency tests

- [ ] **Step 5: Commit**

```bash
git add modules/vpn/subscriptions/vpn-subscription.service.ts modules/vpn/subscriptions/vpn-subscription.service.test.ts
git commit -m "feat(vpn): add currency conversion to VpnSubscriptionService.purchase()"
```

---

### Task 3: Update `VpnSubscriptionDTO` to expose audit fields

**Files:**
- Modify: `modules/vpn/subscriptions/vpn-subscription.dto.ts`
- Modify: `lib/vpn-client.ts` (client types)

**Interfaces:**
- Consumes: `VpnSubscription` with `originalPrice`, `originalCurrency`, `exchangeRate` from Task 1
- Produces: Updated `VpnSubscriptionDTO` type with new fields, updated client `VpnSubscription` type

- [ ] **Step 1: Update VpnSubscriptionDTO type**

In `modules/vpn/subscriptions/vpn-subscription.dto.ts`, add fields to `VpnSubscriptionDTO`:

```typescript
export type VpnSubscriptionDTO = {
  id: string
  organizationId: string
  packageId: string
  status: SubscriptionPayload["status"]
  currentPeriodStart: string
  currentPeriodEnd: string
  deviceCount: number
  serverAccounts: VpnServerAccountDTO[]
  // Multi-currency audit fields
  priceLocked: string
  currency: string
  originalPrice: string | null
  originalCurrency: string | null
  exchangeRate: number | null
  createdAt: string
  updatedAt: string
}
```

Update `toVpnSubscriptionDTO` function to include new fields:

```typescript
export function toVpnSubscriptionDTO(
  subscription: SubscriptionPayload
): VpnSubscriptionDTO {
  return {
    id: subscription.id,
    organizationId: subscription.organizationId,
    packageId: subscription.packageId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    deviceCount: subscription._count.mobileDevices,
    serverAccounts: subscription.serverAccounts.map(toServerAccountDTO),
    priceLocked: subscription.priceLocked.toString(),
    currency: subscription.currency,
    originalPrice: subscription.originalPrice?.toString() ?? null,
    originalCurrency: subscription.originalCurrency ?? null,
    exchangeRate: subscription.exchangeRate
      ? Number(subscription.exchangeRate)
      : null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  }
}
```

- [ ] **Step 2: Update client types in lib/vpn-client.ts**

In `lib/vpn-client.ts`, update the `VpnSubscription` type:

```typescript
export type VpnSubscription = {
  id: string
  organizationId: string
  packageId: string
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED"
  currentPeriodStart: string
  currentPeriodEnd: string
  priceLocked: string
  currency: string
  originalPrice: string | null
  originalCurrency: string | null
  exchangeRate: number | null
  serverAccounts: VpnServerAccount[]
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit --pretty`

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add modules/vpn/subscriptions/vpn-subscription.dto.ts lib/vpn-client.ts
git commit -m "feat(vpn): expose originalPrice, originalCurrency, exchangeRate in subscription DTO"
```

---

### Task 4: Update public DTO to include converted price fields

**Files:**
- Modify: `modules/vpn/subscriptions/vpn-package-public.dto.ts`
- Modify: `modules/vpn/subscriptions/api/vpn-packages-catalog.route.ts`

**Interfaces:**
- Consumes: `CurrencyService.convert()` from Task 2, billing account lookup
- Produces: `VpnPublicPackageDTO` with `convertedPrice`, `convertedCurrency`, `exchangeRate` fields

- [ ] **Step 1: Add converted fields to VpnPublicPackageDTO**

In `modules/vpn/subscriptions/vpn-package-public.dto.ts`, update the DTO types:

```typescript
/** Summary card shape for the package listing grid. */
export type VpnPublicPackageDTO = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string
  serverCount: number
  protocolCount: number
  regions: string[]
  // Multi-currency: converted price for the buyer's billing currency
  convertedPrice: string | null
  convertedCurrency: string | null
  exchangeRate: number | null
}
```

Update `summaryFields` to accept optional conversion params:

```typescript
export type PackageConversion = {
  convertedPrice: Prisma.Decimal
  convertedCurrency: string
  exchangeRate: number
}

function summaryFields(
  pkg: PublicPackagePayload,
  servers: VpnPublicPackageServerDTO[],
  conversion?: PackageConversion
) {
  const regions = Array.from(new Set(servers.map((s) => s.region.name)))
  const protocolCount = servers.reduce((sum, s) => sum + s.protocols.length, 0)
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price.toString(),
    currency: pkg.currency,
    serverCount: servers.length,
    protocolCount,
    regions,
    convertedPrice: conversion?.convertedPrice.toString() ?? null,
    convertedCurrency: conversion?.convertedCurrency ?? null,
    exchangeRate: conversion?.exchangeRate ?? null,
  }
}

export function toVpnPublicPackageDTO(
  pkg: PublicPackagePayload,
  conversion?: PackageConversion
): VpnPublicPackageDTO {
  return summaryFields(pkg, buildServers(pkg), conversion)
}

export function toVpnPublicPackageDetailDTO(
  pkg: PublicPackagePayload,
  conversion?: PackageConversion
): VpnPublicPackageDetailDTO {
  const servers = buildServers(pkg)
  return { ...summaryFields(pkg, servers, conversion), servers }
}
```

- [ ] **Step 2: Update catalog route to compute conversions**

In `modules/vpn/subscriptions/api/vpn-packages-catalog.route.ts`, update to inject auth and CurrencyService:

```typescript
import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { CurrencyService } from "@/modules/billing/currency.service"
import {
  publicPackageInclude,
  toVpnPublicPackageDTO,
  toVpnPublicPackageDetailDTO,
  type PackageConversion,
} from "../vpn-package-public.dto"

type PrismaLike = Pick<typeof prisma, "vpnPackage" | "billingAccount">
type CurrencyServiceLike = Pick<CurrencyService, "convert" | "getRate">

type AuthContext = {
  organizationId?: string | null
  user: { id: string } | null
}

type Deps = {
  db?: PrismaLike
  currency?: CurrencyServiceLike
  authenticate?: () => Promise<AuthContext>
}

/**
 * Public (no-auth) VPN package catalog with optional currency conversion.
 * When authenticated, packages show converted prices for the buyer's currency.
 */
export const createVpnPackageCatalogRoutes = (deps: Deps = {}) => {
  const db = deps.db ?? prisma
  const currency = deps.currency ?? new CurrencyService(prisma)
  const authenticate = deps.authenticate ?? (() => withAuth())

  async function resolveConversion(
    pkgCurrency: string
  ): Promise<PackageConversion | undefined> {
    try {
      const auth = await authenticate()
      if (!auth.user || !auth.organizationId) return undefined

      const account = await db.billingAccount.findUnique({
        where: { organizationId: auth.organizationId },
      })
      if (!account || account.currency === pkgCurrency) return undefined

      const converted = await currency.convert(
        pkg.price,
        pkgCurrency,
        account.currency
      )
      const fromRate = await currency.getRate(pkgCurrency)
      const toRate = await currency.getRate(account.currency)

      return {
        convertedPrice: converted,
        convertedCurrency: account.currency,
        exchangeRate: Number(toRate.div(fromRate)),
      }
    } catch {
      // Auth or conversion failure — return without conversion.
      return undefined
    }
  }

  return new Elysia()
    .get("/vpn/packages", async () => {
      const packages = await db.vpnPackage.findMany({
        where: { isActive: true },
        include: publicPackageInclude,
        orderBy: { price: "asc" },
      })

      const results = await Promise.all(
        packages.map(async (pkg) => {
          const conversion = await resolveConversion(pkg.currency)
          return toVpnPublicPackageDTO(pkg, conversion)
        })
      )

      return { ok: true as const, data: results }
    })
    .get("/vpn/packages/:id", async ({ params, set }) => {
      const pkg = await db.vpnPackage.findFirst({
        where: { id: params.id, isActive: true },
        include: publicPackageInclude,
      })
      if (!pkg) {
        set.status = 404
        return {
          ok: false as const,
          error: "PACKAGE_UNAVAILABLE" as const,
          message: "Package not found or unavailable.",
        }
      }
      const conversion = await resolveConversion(pkg.currency)
      return {
        ok: true as const,
        data: toVpnPublicPackageDetailDTO(pkg, conversion),
      }
    })
}
```

- [ ] **Step 3: Update vpn-client.ts types for package summary**

In `lib/vpn-client.ts`, update `VpnPackageSummary`:

```typescript
export type VpnPackageSummary = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string
  serverCount: number
  protocolCount: number
  regions: string[]
  convertedPrice: string | null
  convertedCurrency: string | null
  exchangeRate: number | null
}
```

- [ ] **Step 4: Run typecheck**

Run: `bunx tsc --noEmit --pretty`

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add modules/vpn/subscriptions/vpn-package-public.dto.ts modules/vpn/subscriptions/api/vpn-packages-catalog.route.ts lib/vpn-client.ts
git commit -m "feat(vpn): add convertedPrice to public package DTO and catalog route"
```

---

### Task 5: Update UI to display converted price as primary

**Files:**
- Modify: `app/[lang]/console/vpn/_components/vpn-packages.tsx`

**Interfaces:**
- Consumes: `VpnPackageSummary` with `convertedPrice`, `convertedCurrency` from Task 4
- Produces: Updated `VpnPackages` component showing converted price as primary, original as reference

- [ ] **Step 1: Update formatPrice helper and add reference formatting**

In `app/[lang]/console/vpn/_components/vpn-packages.tsx`, update `formatPrice` and add a helper:

```typescript
function formatPrice(price: string, currency: string): string {
  const amount = Number(price)
  if (Number.isNaN(amount)) return `${currency} ${price}`
  if (currency === "IDR") {
    return `Rp${amount.toLocaleString("id-ID")}`
  }
  return `${currency} ${amount.toLocaleString("en-US")}`
}

function PriceDisplay({
  price,
  currency,
  convertedPrice,
  convertedCurrency,
}: {
  price: string
  currency: string
  convertedPrice: string | null
  convertedCurrency: string | null
}) {
  // Use converted price as primary when available
  const primaryPrice = convertedPrice ?? price
  const primaryCurrency = convertedCurrency ?? currency
  const showReference = convertedPrice !== null

  return (
    <span>
      {formatPrice(primaryPrice, primaryCurrency)}
      {showReference && (
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          (≈ {formatPrice(price, currency)})
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Update package card to use PriceDisplay**

In the package card grid, replace the price paragraph:

```tsx
<p className="text-lg font-semibold">
  <PriceDisplay
    price={pkg.price}
    currency={pkg.currency}
    convertedPrice={pkg.convertedPrice}
    convertedCurrency={pkg.convertedCurrency}
  />
  <span className="text-sm font-normal text-muted-foreground">
    {" "}
    / month
  </span>
</p>
```

- [ ] **Step 3: Update dialog title to use PriceDisplay**

In the dialog header:

```tsx
<DialogTitle>
  {selected.name} —{" "}
  <PriceDisplay
    price={selected.price}
    currency={selected.currency}
    convertedPrice={selected.convertedPrice}
    convertedCurrency={selected.convertedCurrency}
  />
  /month
</DialogTitle>
```

- [ ] **Step 4: Update Buy Now button to show converted price**

In the buy button:

```tsx
<Button onClick={handleBuy} disabled={purchasing}>
  {purchasing
    ? "Processing…"
    : `Buy Now — ${formatPrice(
        selected.convertedPrice ?? selected.price,
        selected.convertedCurrency ?? selected.currency
      )}`}
</Button>
```

- [ ] **Step 5: Run lint on the changed file**

Run: `bunx eslint app/[lang]/console/vpn/_components/vpn-packages.tsx`

Expected: 0 errors

- [ ] **Step 6: Run typecheck**

Run: `bunx tsc --noEmit --pretty`

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add app/[lang]/console/vpn/_components/vpn-packages.tsx
git commit -m "feat(vpn): display converted currency price as primary in package cards"
```

---

### Task 6: Replace hardcoded FX rate in legacy VPN route with `CurrencyService`

**Files:**
- Modify: `modules/vpn/billing/vpn-pricing.ts`
- Modify: `modules/vpn/billing/vpn-pricing.test.ts`
- Modify: `modules/vpn/api/vpn.route.ts`

**Interfaces:**
- Consumes: `CurrencyService` from `@/modules/billing/currency.service`
- Produces: `resolveVpnMonthlyPrice` accepting optional `CurrencyService` for dynamic rates

- [ ] **Step 1: Write failing test for dynamic rate**

In `modules/vpn/billing/vpn-pricing.test.ts`, add:

```typescript
import { CurrencyService } from "@/modules/billing/currency.service"

// ... existing tests ...

describe("resolveVpnMonthlyPrice with CurrencyService", () => {
  it("uses dynamic rate from CurrencyService when provided", async () => {
    // Mock CurrencyService.convert: 25000 IDR → 1.25 USD (rate = 20000)
    const mockCurrency = {
      convert: mock(
        async () => new Prisma.Decimal("1.25")
      ),
      getRate: mock(async (code: string) =>
        new Prisma.Decimal(code === "USD" ? "1" : "20000")
      ),
    }

    const result = await resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
      currency: "USD",
      currencyService: mockCurrency as unknown as CurrencyService,
    })
    expect(result.currency).toBe("USD")
    expect(result.amount.toString()).toBe("1.25")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test modules/vpn/billing/vpn-pricing.test.ts`

Expected: FAIL — `resolveVpnMonthlyPrice` doesn't accept `currencyService` option

- [ ] **Step 3: Update resolveVpnMonthlyPrice to accept optional CurrencyService**

In `modules/vpn/billing/vpn-pricing.ts`:

Update imports:
```typescript
import { Prisma } from "@prisma/client"
import { CurrencyService } from "@/modules/billing/currency.service"
```

Update `ResolveVpnMonthlyPriceInput`:
```typescript
export type ResolveVpnMonthlyPriceInput = {
  regionCode: string
  planCode: string
  /**
   * Account currency. Defaults to IDR for backward compatibility.
   * When USD, the IDR amount is converted using the rate from
   * CurrencyService (PaymentCurrency table) if provided, otherwise
   * the hardcoded fixed rate.
   */
  currency?: "IDR" | "USD"
  /** Optional CurrencyService for dynamic rate lookup. */
  currencyService?: CurrencyService
}
```

Update `resolveVpnMonthlyPrice` to be async and use dynamic rate:
```typescript
export async function resolveVpnMonthlyPrice(
  input: ResolveVpnMonthlyPriceInput
): Promise<VpnResolvedPrice> {
  const region = CATALOG[input.regionCode as RegionCode]
  if (!region) {
    throw new VpnPriceNotConfiguredError(input.regionCode, input.planCode)
  }
  const idrAmount = region[input.planCode as PlanCode]
  if (!idrAmount) {
    throw new VpnPriceNotConfiguredError(input.regionCode, input.planCode)
  }

  if (input.currency === "USD") {
    let rate = IDR_USD_FIXED_RATE
    if (input.currencyService) {
      try {
        rate = await input.currencyService.getRate("IDR")
      } catch {
        // Fallback to hardcoded rate if CurrencyService fails
      }
    }
    return {
      amount: idrAmount.div(rate),
      currency: "USD",
    }
  }
  return { amount: idrAmount, currency: "IDR" }
}
```

- [ ] **Step 4: Update existing tests to handle async**

The existing tests call `resolveVpnMonthlyPrice` synchronously. Update them to use `await`:

```typescript
// Change all existing test calls from:
const result = resolveVpnMonthlyPrice({...})
// To:
const result = await resolveVpnMonthlyPrice({...})
```

Also update the `expect(() => ...).toThrow(...)` tests:
```typescript
// Change from:
expect(() =>
  resolveVpnMonthlyPrice({...})
).toThrow(VpnPriceNotConfiguredError)
// To:
await expect(
  resolveVpnMonthlyPrice({...})
).rejects.toThrow(VpnPriceNotConfiguredError)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test modules/vpn/billing/vpn-pricing.test.ts`

Expected: All tests pass

- [ ] **Step 6: Update legacy VPN route to use CurrencyService**

In `modules/vpn/api/vpn.route.ts`:

Add import:
```typescript
import { CurrencyService } from "@/modules/billing/currency.service"
```

Add `currency` to `VpnRouteDeps`:
```typescript
type VpnRouteDeps = {
  authenticate?: () => Promise<VpnAuthContext>
  billing?: VpnBillingLike
  openVpn?: OpenVpnLike
  vpnClients?: VpnClientServiceLike
  currency?: CurrencyService
}
```

Update `createVpnRoutes` to accept currency service:
```typescript
export const createVpnRoutes = (deps: Partial<VpnRouteDeps> = {}) => {
  const authenticate = deps.authenticate ?? defaultAuthenticate
  const billing = deps.billing ?? defaultBilling()
  const openVpn = deps.openVpn ?? defaultOpenVpn()
  const vpnClients = deps.vpnClients ?? defaultVpnClients()
  const currency = deps.currency ?? new CurrencyService(prisma)
```

Update the price resolution call (line ~298) to pass CurrencyService:
```typescript
        price = await resolveVpnMonthlyPrice({
            regionCode: body.regionCode,
            planCode: body.planCode,
            currency: account.currency as "IDR" | "USD",
            currencyService: currency,
          })
```

Note: Since `resolveVpnMonthlyPrice` is now async, the surrounding code already uses `await` (it's inside an async route handler), so this works without further changes.

- [ ] **Step 7: Run typecheck**

Run: `bunx tsc --noEmit --pretty`

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add modules/vpn/billing/vpn-pricing.ts modules/vpn/billing/vpn-pricing.test.ts modules/vpn/api/vpn.route.ts
git commit -m "feat(vpn): replace hardcoded FX rate with CurrencyService dynamic rates"
```

---

### Task 7: Update billing info endpoint to include original price fields

**Files:**
- Modify: `modules/vpn/subscriptions/api/vpn-subscriptions.route.ts`

**Interfaces:**
- Consumes: `VpnSubscriptionService.getBillingInfo()` from Task 2
- Produces: Updated billing info response with `originalPrice`, `originalCurrency`, `exchangeRate`

- [ ] **Step 1: Update getBillingInfo to include new fields**

In `modules/vpn/subscriptions/vpn-subscription.service.ts`, update `getBillingInfo` select:

```typescript
  async getBillingInfo(organizationId: string, id: string) {
    const sub = await this.prisma.vpnSubscription.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        priceLocked: true,
        currency: true,
        originalPrice: true,
        originalCurrency: true,
        exchangeRate: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        renewalFailedAt: true,
      },
    })
    if (!sub) throw new VpnSubscriptionNotFoundError()
    return sub
  }
```

- [ ] **Step 2: Update billing info route response**

In `modules/vpn/subscriptions/api/vpn-subscriptions.route.ts`, update the billing info response:

```typescript
        return {
          ok: true as const,
          data: {
            id: info.id,
            status: info.status,
            price: info.priceLocked.toString(),
            currency: info.currency,
            originalPrice: info.originalPrice?.toString() ?? null,
            originalCurrency: info.originalCurrency ?? null,
            exchangeRate: info.exchangeRate ? Number(info.exchangeRate) : null,
            currentPeriodStart: info.currentPeriodStart.toISOString(),
            currentPeriodEnd: info.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: info.cancelAtPeriodEnd,
            renewalFailedAt: info.renewalFailedAt
              ? info.renewalFailedAt.toISOString()
              : null,
          },
        }
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit --pretty`

Expected: 0 errors

- [ ] **Step 4: Run full test suite**

Run: `bun test`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add modules/vpn/subscriptions/vpn-subscription.service.ts modules/vpn/subscriptions/api/vpn-subscriptions.route.ts
git commit -m "feat(vpn): expose original price fields in billing info endpoint"
```

---

### Task 8: Final validation — full pillar checks

**Files:** None (validation only)

- [ ] **Step 1: Run lint**

Run: `bun run lint`

Expected: 0 errors

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: 0 errors

- [ ] **Step 3: Run all tests**

Run: `bun run test`

Expected: All tests pass

- [ ] **Step 4: Run build**

Run: `bun run build`

Expected: Build succeeds
