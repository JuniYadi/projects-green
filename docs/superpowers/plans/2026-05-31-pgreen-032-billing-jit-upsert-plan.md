# PGREEN-032: Billing JIT Upsert — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 404 error when no BillingAccount exists with JIT upsert that auto-creates a default Tenant + BillingAccount for the org on first access.

**Architecture:** Add a `ensureBillingAccountForOrg` service function that runs a Prisma transaction to find/create Tenant (by code=organizationId) then find/create BillingAccount (by organizationId). Inject as dependency into the existing route. Uses WorkOS API to get org name for Tenant.

**Tech Stack:** TypeScript, Prisma ORM, WorkOS SDK, Elysia.js, Bun test runner

---

## File Structure

```
modules/billing/
  billing-account.service.ts     [NEW]
  billing-account.service.test.ts [NEW]
  api/
    account.route.ts             [MODIFY]
    account.route.test.ts        [MODIFY]
```

---

## Task 1: Create billing-account.service.ts

**Files:**
- Create: `modules/billing/billing-account.service.ts`
- Test: `modules/billing/billing-account.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `modules/billing/billing-account.service.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "bun:test"
import type { PrismaClient, Tenant, BillingAccount } from "@prisma/client"

// Import the module AFTER mocking prisma
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

import { ensureBillingAccountForOrg } from "./billing-account.service"

const mockGetOrganizationAction = vi.fn()

const mockPrisma = {
  $transaction: vi.fn(),
  tenant: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  billingAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}

describe("ensureBillingAccountForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing billing account when it exists", async () => {
    const existingAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
      organizationId: "org_123",
      balance: 100_000,
    }

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValue(existingAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toEqual(existingAccount)
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingAccount.create).not.toHaveBeenCalled()
  })

  it("creates both Tenant and BillingAccount when both are missing", async () => {
    const newTenant = { id: "tenant-1", code: "org_123", name: "My Org" }
    const newAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
      organizationId: "org_123",
      balance: 0,
    }
    const orgFromWorkOS = { id: "org_123", name: "My Org" }

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(null)
    mockPrisma.tenant.create.mockResolvedValue(newTenant)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)
    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toEqual(newAccount)
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { code: "org_123" },
    })
    expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
      data: { code: "org_123", name: "My Org" },
    })
    expect(mockPrisma.billingAccount.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org_123" },
    })
    expect(mockPrisma.billingAccount.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        organizationId: "org_123",
        balance: expect.anything(),
        currency: "USD",
      },
    })
  })

  it("creates only BillingAccount when Tenant already exists", async () => {
    const existingTenant = { id: "tenant-1", code: "org_123", name: "My Org" }
    const newAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
      organizationId: "org_123",
      balance: 0,
    }

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(existingTenant)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toEqual(newAccount)
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingAccount.create).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun test modules/billing/billing-account.service.test.ts -v`
Expected: FAIL — "Cannot find module './billing-account.service'" or similar

- [ ] **Step 3: Write minimal implementation**

Create `modules/billing/billing-account.service.ts`:

```typescript
import { Prisma } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

import { prisma } from "@/lib/prisma"

type WorkOSOrganization = {
  id: string
  name: string
}

export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (orgId: string) => Promise<WorkOSOrganization>
}) => {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun test modules/billing/billing-account.service.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/billing/billing-account.service.ts modules/billing/billing-account.service.test.ts
git commit -m "feat(billing): add ensureBillingAccountForOrg JIT upsert service"
```

---

## Task 2: Modify account.route.ts to use JIT upsert

**Files:**
- Modify: `modules/billing/api/account.route.ts`
- Test: `modules/billing/api/account.route.test.ts` (add new tests)

- [ ] **Step 1: Read current route file**

Read `modules/billing/api/account.route.ts` and identify the section to replace (lines 94-102 approximately).

- [ ] **Step 2: Update imports and dependency type**

Add import for `ensureBillingAccountForOrg`:

```typescript
import { prisma } from "@/lib/prisma"
import { MINIMUM_BALANCE_WARN_IDR } from "../constants"
import { ensureBillingAccountForOrg } from "../billing-account.service"
```

Update `BillingAccountRouteDeps` type:

```typescript
type BillingAccountRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  ensureBillingAccountForOrg: typeof ensureBillingAccountForOrg
}
```

Update `defaultDeps`:

```typescript
const defaultDeps: BillingAccountRouteDeps = {
  authenticate: () => withAuth(),
  ensureBillingAccountForOrg,
}
```

Add `getOrganizationAction` import at the top:

```typescript
import { withAuth, getOrganizationAction } from "@workos-inc/authkit-nextjs"
```

- [ ] **Step 3: Replace 404 logic with JIT upsert**

Find and replace this block inside the `GET /account` handler (around lines 94-102):

```typescript
// OLD (return 404 if not found)
const account = await prisma.billingAccount.findUnique({
  where: { organizationId: auth.organizationId },
})

if (!account) {
  return toNotFound(set, "Billing account not found.")
}

// NEW (JIT upsert)
const account = await deps.ensureBillingAccountForOrg({
  organizationId: auth.organizationId,
  getOrganizationAction,
})
```

- [ ] **Step 4: Add test for JIT upsert behavior**

Add to `modules/billing/api/account.route.test.ts`:

```typescript
import { createBillingAccountRoutes } from "./account.route"

describe("GET /account - JIT upsert", () => {
  const mockEnsureBillingAccountForOrg = vi.fn()
  const mockGetOrganizationAction = vi.fn()

  const mockAuth = {
    user: { id: "user-1", email: "test@example.com" },
    organizationId: "org_123",
  }

  const createRoute = () =>
    createBillingAccountRoutes({
      authenticate: async () => mockAuth as any,
      ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg as any,
    })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls ensureBillingAccountForOrg when accessing account", async () => {
    const mockAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(100_000),
      currency: "USD",
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.ok).toBe(true)
    expect(mockEnsureBillingAccountForOrg).toHaveBeenCalledWith({
      organizationId: "org_123",
      getOrganizationAction: expect.any(Function),
    })
  })
})
```

- [ ] **Step 5: Run all billing tests**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun test modules/billing -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add modules/billing/api/account.route.ts modules/billing/api/account.route.test.ts
git commit -m "feat(billing): use JIT upsert in account route, replace 404"
```

---

## Task 3: Run full verification

- [ ] **Step 1: Run typecheck**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun run typecheck`
Expected: 0 errors

- [ ] **Step 2: Run lint**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun run lint`
Expected: 0 errors

- [ ] **Step 3: Run all tests**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun run test`
Expected: All tests pass

- [ ] **Step 4: Run coverage**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun run test:coverage`
Expected: No coverage regression

- [ ] **Step 5: Run build**

Run: `cd /Users/juniyadi/github-yadi/projects-green && bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "fix(billing): PGREEN-032 - JIT upsert for missing BillingAccount"
```

---

## Summary

| Task | Files | Steps |
|------|-------|-------|
| 1 | `billing-account.service.ts`, `billing-account.service.test.ts` | Create service with upsert logic |
| 2 | `account.route.ts`, `account.route.test.ts` | Use service, remove 404 |
| 3 | — | Full verification (typecheck, lint, test, coverage, build) |
