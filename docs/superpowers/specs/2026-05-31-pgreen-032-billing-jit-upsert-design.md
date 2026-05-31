# PGREEN-032: Billing JIT Upsert — Design Spec

**Date:** 2026-05-31
**Status:** Draft

## Context

The `GET /api/billing/account` endpoint currently returns a 404 error when no `BillingAccount` exists for the user's organization. This breaks the Portal billing UI flow, which expects the endpoint to always return billing data once the user is authenticated.

We need JIT (Just-In-Time) upsert: if no billing account exists for the org, create one automatically on first access.

## Data Model

```
BillingAccount
  tenantId       String @unique   → references Tenant.id
  organizationId String @unique  → WorkOS organization ID
  balance        Decimal @default(0)
  currency       String @default("USD")
  ...

Tenant
  id        String @id
  code      String @unique   → we'll set code = organizationId
  name      String
  isActive  Boolean @default(true)
```

**Deduplication strategy:** `Tenant.code = organizationId`. Each WorkOS org gets exactly one Tenant, identified by its WorkOS org ID. This is safe because WorkOS org IDs are immutable CUIDs.

## Design

### New Service: `billing-account.service.ts`

Location: `modules/billing/billing-account.service.ts`

```typescript
export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (orgId: string) => Promise<WorkOSOrganization>
}): Promise<BillingAccount> => {
  const { organizationId, getOrganizationAction } = params

  return prisma.$transaction(async (tx) => {
    // 1. Find or create Tenant
    let tenant = await tx.tenant.findUnique({
      where: { code: organizationId },
    })

    if (!tenant) {
      // Fetch org name from WorkOS
      const org = await getOrganizationAction(organizationId)

      tenant = await tx.tenant.create({
        data: {
          code: organizationId,
          name: org.name,
        },
      })
    }

    // 2. Find or create BillingAccount
    let account = await tx.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      account = await tx.billingAccount.create({
        data: {
          tenantId: tenant.id,
          organizationId,
          balance: new Decimal(0),
          currency: "USD",
        },
      })
    }

    return account
  })
}
```

### Route Change: `account.route.ts`

Replace the `findUnique` + 404 logic:

```typescript
// Before
const account = await prisma.billingAccount.findUnique({
  where: { organizationId: auth.organizationId },
})
if (!account) {
  return toNotFound(set, "Billing account not found.")
}

// After
const account = await ensureBillingAccountForOrg({
  organizationId: auth.organizationId,
  getOrganizationAction,
})
```

### Dependency Injection

The route already has DI set up. We add `ensureBillingAccountForOrg` as a dependency:

```typescript
type BillingAccountRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  ensureBillingAccountForOrg: typeof ensureBillingAccountForOrg
}

const defaultDeps: BillingAccountRouteDeps = {
  authenticate,
  ensureBillingAccountForOrg,
}
```

### Error Handling

| Error | Response |
|---|---|
| WorkOS org not found | 500 — "Unable to load organization details" |
| Prisma unique constraint (race) | Retry the find, should succeed |
| Other Prisma errors | 500 — "Unable to load billing account" |

## Files Changed

| File | Change |
|---|---|
| `modules/billing/billing-account.service.ts` | **New** — `ensureBillingAccountForOrg` function |
| `modules/billing/api/account.route.ts` | Replace 404 with JIT upsert; inject service |

## Testing

### Unit Tests

1. **Account exists** — `ensureBillingAccountForOrg` returns existing account without creating anything
2. **Account missing, Tenant missing** — creates both Tenant (with org name) and BillingAccount
3. **Account missing, Tenant exists** — creates only BillingAccount (Tenant reuse)
4. **Race condition** — two concurrent calls with same orgId → one create succeeds, one handles unique constraint gracefully
5. **WorkOS org lookup fails** — propagates error to route handler

### Route Tests

1. **Authenticated + has account** — returns billing data (existing behavior)
2. **Authenticated + no account** — creates account on demand, returns billing data
3. **Unauthenticated** — returns 401 (existing behavior)

## Verification

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun run test` — all pass
- [ ] `bun run test:coverage` — no regression
- [ ] `bun run build` — production build succeeds

## Dependencies

- PGREEN-032 is independent — no blocking dependencies
- This change unblocks: Portal billing UI (PGREEN-035 scope)
