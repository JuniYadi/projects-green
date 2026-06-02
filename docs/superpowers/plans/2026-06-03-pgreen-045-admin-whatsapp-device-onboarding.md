# PGREEN-045: Admin WhatsApp Device Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Add Device` flow on `/admin/whatsapp/devices` that lets super admin create a device on behalf of any organization, with optional WA Business Account fields. Backed by `POST /api/admin/devices` and `GET /api/admin/organizations`. Migrate all admin-device handlers to `requireSuperAdmin`.

**Architecture:** Extend the existing `devicesService.create()` (single source of truth) with the new optional fields; expose them through a new `adminCreateDeviceSchema`; migrate the admin route to a factory with deps-injected `requireSuperAdmin`; add a new admin page dialog following the console page patterns.

**Tech Stack:** Next.js 16, Elysia, Zod, Prisma, WorkOS SDK, React, shadcn/ui (Dialog, Select, Input, Button), sonner toast, Bun test.

**Worktree:** `~/.config/superpowers/worktrees/projects-green/feat-pgreen-045-admin-whatsapp-device-onboarding`
**Branch:** `feat/pgreen-045-admin-whatsapp-device-onboarding`
**Spec:** `docs/superpowers/specs/2026-06-03-pgreen-045-admin-whatsapp-device-onboarding-design.md`

**Conventions:** Path alias `@/*`. No comments in code. 2-space indent, double quotes, no semicolons, 80-char line width. Tests use `bun test` with the same `mock.module` patterns as the existing `admin-devices.route.test.ts`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `modules/whatsapp/devices/devices.schemas.ts` | Modify | Add `adminCreateDeviceSchema`; widen `CreateDeviceInput` |
| `modules/whatsapp/devices/devices.service.ts` | Modify | Persist 4 WA fields + `displayName` in `create()` |
| `modules/whatsapp/devices/api/admin-devices.route.ts` | Modify | Factory + deps-injected guard; migrate to `requireSuperAdmin`; add `POST /` |
| `modules/whatsapp/devices/api/admin-devices.route.test.ts` | Rewrite | Mock `requireSuperAdmin`; cover 401/403/422/201 |
| `modules/admin/admin.service.ts` | Modify | Add `listAdminOrganizations()` |
| `modules/admin/api/routes/admin-organizations.route.ts` | Modify | Add `GET /admin/organizations` |
| `modules/admin/api/routes/admin-organizations.route.test.ts` | Create | Test the new GET endpoint |
| `app/[lang]/admin/whatsapp/devices/page.tsx` | Modify | Add `Add Device` button + Dialog; fetch orgs; submit |
| `FEATURES.md` | Modify | Update section 3.2 row |

---

## Task 1: Add `adminCreateDeviceSchema` and widen `CreateDeviceInput`

**Files:**
- Modify: `modules/whatsapp/devices/devices.schemas.ts`

- [ ] **Step 1: Widen `CreateDeviceInput` to include the new optional fields**

In `modules/whatsapp/devices/devices.schemas.ts`, replace the existing `createDeviceSchema` (lines 19-24) with:

```ts
export const createDeviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
  environment: deviceEnvironmentEnum.optional().default("LIVE"),
  displayName: z.string().trim().max(120).optional(),
  whatsappBusinessAccountId: z.string().trim().max(64).optional(),
  whatsappPhoneId: z.string().trim().max(64).optional(),
  whatsappApplicationId: z.string().trim().max(64).optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
})
```

`CreateDeviceInput` (line 24) is inferred from this — no change needed.

- [ ] **Step 2: Add `adminCreateDeviceSchema` immediately below `createDeviceSchema`**

Append after the `createDeviceSchema` block:

```ts
export const adminCreateDeviceSchema = createDeviceSchema.extend({
  organizationId: z
    .string()
    .trim()
    .min(1, "Organization ID is required"),
})
export type AdminCreateDeviceInput = z.infer<typeof adminCreateDeviceSchema>
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add modules/whatsapp/devices/devices.schemas.ts
git commit -m "feat(schemas): add adminCreateDeviceSchema + widen CreateDeviceInput"
```

---

## Task 2: Persist the new fields in `devicesService.create()`

**Files:**
- Modify: `modules/whatsapp/devices/devices.service.ts:92-103`

- [ ] **Step 1: Update the `create()` body**

Replace the `create` method (lines 92-103) with:

```ts
async create(input) {
  const device = await db.whatsappDevice.create({
    data: {
      organizationId: input.organizationId ?? "",
      phoneNumber: input.phoneNumber,
      status: "ACTIVE",
      whatsappBusinessAccountId: input.whatsappBusinessAccountId ?? null,
      whatsappPhoneId: input.whatsappPhoneId ?? null,
      whatsappApplicationId: input.whatsappApplicationId ?? null,
      callbackUrl: input.callbackUrl || null,
      ...(input.displayName
        ? { whatsappProfile: { name: input.displayName } }
        : {}),
    },
  })
  return _toDeviceDetail(device as PrismaDeviceFields)
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors. `input` is typed as `CreateDeviceInput & { organizationId: string | null }` (line 93), which now includes the 5 new optional fields.

- [ ] **Step 3: Run the existing service tests to ensure no regression**

Run: `bun run test modules/whatsapp/devices/ 2>&1 | tail -20`
Expected: all existing tests pass (the service is consumed by other tests via mocking).

- [ ] **Step 4: Commit**

```bash
git add modules/whatsapp/devices/devices.service.ts
git commit -m "feat(devices): persist WA Business Account fields + displayName on create"
```

---

## Task 3: Convert `admin-devices.route.ts` to factory with `requireSuperAdmin`

**Files:**
- Modify: `modules/whatsapp/devices/api/admin-devices.route.ts`

- [ ] **Step 1: Replace the file with the new factory implementation**

The full new content of `modules/whatsapp/devices/api/admin-devices.route.ts`:

```ts
/**
 * WhatsApp Devices — Admin API Routes
 *
 * Mounted at /api/whatsapp/admin/devices
 */

import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  adminCreateDeviceSchema,
  topUpInputSchema,
} from "../devices.schemas"
import { createDeviceService } from "../devices.service"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

const MAX_BALANCE = new Decimal("999999999.99")

type RouteSet = {
  status?: number | string
}

type AdminGuard = (
  set: RouteSet
) => Promise<AdminActorContext | AdminApiError>

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

const isAdminError = (
  value: AdminActorContext | AdminApiError
): value is AdminApiError => "ok" in value && !value.ok

export const createAdminDevicesRoutes = (
  deps: { requireSuperAdmin?: AdminGuard } = {}
) => {
  const guard: AdminGuard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/devices" })
    .get("/", async ({ query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const take = Math.min(Number(query.take) || 50, 100)
      const skip = Number(query.skip) || 0

      const [devices, total] = await Promise.all([
        prisma.whatsappDevice.findMany({
          orderBy: { createdAt: "desc" },
          take,
          skip,
        }),
        prisma.whatsappDevice.count(),
      ])

      return {
        ok: true as const,
        devices: devices.map((d) => ({
          id: d.id,
          organizationId: d.organizationId,
          phoneNumber: d.phoneNumber,
          status: d.status,
          balance: Number(d.balance.toString()),
          quotaBase: Number(d.quotaBase.toString()),
          dailyLimitMessage: d.dailyLimitMessage,
          whatsappBusinessAccountId: d.whatsappBusinessAccountId,
          whatsappPhoneId: d.whatsappPhoneId,
          whatsappApplicationId: d.whatsappApplicationId,
          callbackUrl: d.callbackUrl,
          whatsappProfile: d.whatsappProfile,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        total,
        take,
        skip,
      }
    })
    .get("/:id", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const device = await prisma.whatsappDevice.findUnique({
        where: { id },
      })

      if (!device) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Device not found.",
        }
      }

      return {
        ok: true as const,
        device: {
          id: device.id,
          organizationId: device.organizationId,
          phoneNumber: device.phoneNumber,
          status: device.status,
          balance: Number(device.balance.toString()),
          quotaBase: Number(device.quotaBase.toString()),
          quotaBaseIn: device.quotaBaseIn,
          quotaBaseOut: device.quotaBaseOut,
          dailyLimitMessage: device.dailyLimitMessage,
          whatsappBusinessAccountId: device.whatsappBusinessAccountId,
          whatsappPhoneId: device.whatsappPhoneId,
          whatsappApplicationId: device.whatsappApplicationId,
          callbackUrl: device.callbackUrl,
          expiredAt: device.expiredAt?.toISOString() ?? null,
          whatsappProfile: device.whatsappProfile,
          createdAt: device.createdAt.toISOString(),
          updatedAt: device.updatedAt.toISOString(),
        },
      }
    })
    .post(
      "/",
      async ({ body, set }: any) => {
        const actor = await guard(set)
        if (isAdminError(actor)) return actor

        const parsed = adminCreateDeviceSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        try {
          const device = await createDeviceService().create({
            ...parsed.data,
            organizationId: parsed.data.organizationId,
          })

          set.status = 201
          return { ok: true as const, device }
        } catch (error) {
          console.error("[AdminDevices] Create error:", error)
          return toServerError(set, "Unable to create device.")
        }
      },
      { body: adminCreateDeviceSchema }
    )
    .post("/:id/top-up", async ({ params: { id }, body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = topUpInputSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { amount, reason } = parsed.data

      try {
        const result = await prisma.$transaction(async (tx) => {
          const device = await tx.whatsappDevice.findUnique({
            where: { id },
          })

          if (!device) {
            throw new Error("DEVICE_NOT_FOUND")
          }

          const balanceAfter = device.balance.plus(amount)

          if (balanceAfter.gt(MAX_BALANCE)) {
            throw new Error("BALANCE_LIMIT_EXCEEDED")
          }

          let billingAccount = await tx.billingAccount.findUnique({
            where: { organizationId: device.organizationId },
          })

          if (!billingAccount) {
            billingAccount = await tx.billingAccount.create({
              data: {
                organizationId: device.organizationId,
                balance: new Decimal(0),
                currency: "IDR",
              },
            })
          }

          const [updatedDevice] = await Promise.all([
            tx.whatsappDevice.update({
              where: { id },
              data: { balance: balanceAfter },
            }),
            tx.billingAdjustment.create({
              data: {
                billingAccountId: billingAccount.id,
                adjustmentType: "CREDIT",
                amount: new Decimal(amount),
                currency: "IDR",
                reason: `Device top-up: ${reason} (device: ${id})`,
                metadataJson: {
                  deviceId: id,
                  performedBy: actor.userId,
                },
              },
            }),
          ])

          return { updatedDevice }
        })

        return {
          ok: true as const,
          newBalance: Number(result.updatedDevice.balance.toString()),
          amount,
        }
      } catch (error) {
        if (error instanceof Error && error.message === "DEVICE_NOT_FOUND") {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Device not found.",
          }
        }

        if (error instanceof Error && error.message === "BALANCE_LIMIT_EXCEEDED") {
          set.status = 400
          return {
            ok: false as const,
            error: "BALANCE_LIMIT_EXCEEDED" as const,
            message: "Top-up would exceed maximum balance.",
          }
        }

        console.error("[AdminDevices] Top-up error:", error)
        return toServerError(set, "Unable to process top-up.")
      }
    })
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add modules/whatsapp/devices/api/admin-devices.route.ts
git commit -m "feat(admin-devices): migrate to requireSuperAdmin + add POST /"
```

Note: the existing `admin-devices.route.test.ts` is now broken. Task 4 fixes it.

---

## Task 4: Rewrite `admin-devices.route.test.ts`

**Files:**
- Rewrite: `modules/whatsapp/devices/api/admin-devices.route.test.ts`

- [ ] **Step 1: Replace the file with the new test suite**

The full new content of `modules/whatsapp/devices/api/admin-devices.route.test.ts`:

```ts
/**
 * WhatsApp Devices — Admin API Routes Tests
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFindMany = mock<(...args: any[]) => any>(async () => [])
const mockCount = mock<(...args: any[]) => any>(async () => 0)
const mockFindUnique = mock<(...args: any[]) => any>(async () => null)
const mockUpdate = mock<(...args: any[]) => any>(async () => ({}))
const mockCreate = mock<(...args: any[]) => any>(async () => ({}))
const mockBillingFindUnique = mock<(...args: any[]) => any>(async () => null)
const mockBillingCreate = mock<(...args: any[]) => any>(
  async () => ({ id: "ba-1", balance: 0 })
)
const mockAdjustmentCreate = mock<(...args: any[]) => any>(
  async () => ({ id: "adj-1" })
)
const mockTransaction = mock<(...args: any[]) => any>(async (fn: (tx: any) => any) =>
  fn({
    whatsappDevice: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
    billingAccount: {
      findUnique: mockBillingFindUnique,
      create: mockBillingCreate,
    },
    billingAdjustment: {
      create: mockAdjustmentCreate,
    },
  })
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
    billingAccount: {
      findUnique: mockBillingFindUnique,
      create: mockBillingCreate,
    },
    billingAdjustment: {
      create: mockAdjustmentCreate,
    },
    $transaction: mockTransaction,
  },
}))

const mockRequireSuperAdmin = mock<(...args: any[]) => any>(async () => ({
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

const mockUnauthorized = (set: any) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to perform this action.",
  }
}

const mockForbidden = (set: any) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    policyCode: "SUPER_ADMIN_REQUIRED" as const,
    message: "This action requires super admin access.",
  }
}

// Module under test — must be imported AFTER mocks
const { createAdminDevicesRoutes } = await import("./admin-devices.route")

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestApp() {
  return new Elysia().use(createAdminDevicesRoutes())
}

const BASE = "http://localhost/admin/devices"

function unauthorizedContext() {
  mockRequireSuperAdmin.mockImplementation(mockUnauthorized)
}

function forbiddenContext() {
  mockRequireSuperAdmin.mockImplementation(mockForbidden)
}

function superAdminContext() {
  mockRequireSuperAdmin.mockImplementation(async () => ({
    userId: "admin-1",
    platformRole: "super_admin" as const,
  }))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Admin Devices Routes", () => {
  beforeEach(() => {
    mockFindMany.mockImplementation(async () => [])
    mockCount.mockImplementation(async () => 0)
    mockFindUnique.mockImplementation(async () => null)
    mockUpdate.mockImplementation(async () => ({}))
    mockCreate.mockImplementation(async () => ({}))
    mockBillingFindUnique.mockImplementation(async () => null)
    mockBillingCreate.mockImplementation(async () => ({
      id: "ba-1",
      balance: 0,
    }))
    mockAdjustmentCreate.mockImplementation(async () => ({ id: "adj-1" }))
    superAdminContext()
  })

  // ─── GET / ──────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when not authenticated", async () => {
      unauthorizedContext()

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when authenticated but not super admin", async () => {
      forbiddenContext()

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.policyCode).toBe("SUPER_ADMIN_REQUIRED")
    })

    it("returns all devices when super admin", async () => {
      const devices = [
        {
          id: "dev-1",
          organizationId: "org-1",
          phoneNumber: "+6281234567890",
          status: "ACTIVE",
          balance: 100000,
          quotaBase: 1000,
          dailyLimitMessage: 500,
          whatsappBusinessAccountId: null,
          whatsappPhoneId: null,
          whatsappApplicationId: null,
          callbackUrl: null,
          whatsappProfile: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-15"),
        },
      ]
      mockFindMany.mockImplementation(async () => devices)

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.devices).toHaveLength(1)
      expect(body.devices[0].id).toBe("dev-1")
    })

    it("returns empty list when no devices", async () => {
      mockFindMany.mockImplementation(async () => [])

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.devices).toEqual([])
    })
  })

  // ─── GET /:id ───────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
    it("returns 401 when not authenticated", async () => {
      unauthorizedContext()

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/dev-1`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockImplementation(async () => null)

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/nonexistent`))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns device detail when found", async () => {
      const device = {
        id: "dev-1",
        organizationId: "org-1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        balance: 250000,
        quotaBase: 2000,
        quotaBaseIn: 100,
        quotaBaseOut: 100,
        dailyLimitMessage: 500,
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
        whatsappApplicationId: "app-1",
        callbackUrl: "https://example.com/callback",
        expiredAt: null,
        whatsappProfile: { name: "Primary" },
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-15"),
      }
      mockFindUnique.mockImplementation(async () => device)

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/dev-1`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.device.id).toBe("dev-1")
      expect(body.device.balance).toBe(250000)
      expect(body.device.whatsappProfile).toEqual({ name: "Primary" })
    })
  })

  // ─── POST / ─────────────────────────────────────────────────────────────────

  describe("POST /", () => {
    it("returns 401 when not authenticated", async () => {
      unauthorizedContext()

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      forbiddenContext()

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 when organizationId is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors.organizationId).toBeDefined()
    })

    it("returns 422 when phoneNumber is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors.phoneNumber).toBeDefined()
    })

    it("returns 201 and creates device with minimal body", async () => {
      const createdDevice = {
        id: "dev-new",
        organizationId: "org-1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        balance: { toString: () => "0", valueOf: () => 0 },
        quotaBase: { toString: () => "1000", valueOf: () => 1000 },
        dailyLimitMessage: 0,
        whatsappBusinessAccountId: null,
        whatsappPhoneId: null,
        whatsappApplicationId: null,
        callbackUrl: null,
        expiredAt: null,
        whatsappProfile: null,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      }
      mockCreate.mockImplementation(async () => createdDevice)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(body.device.id).toBe("dev-new")
      expect(body.device.organizationId).toBe("org-1")
    })

    it("returns 201 and persists all optional fields", async () => {
      let capturedData: any = null
      mockCreate.mockImplementation(async ({ data }: any) => {
        capturedData = data
        return {
          id: "dev-full",
          organizationId: data.organizationId,
          phoneNumber: data.phoneNumber,
          status: "ACTIVE",
          balance: { toString: () => "0", valueOf: () => 0 },
          quotaBase: { toString: () => "1000", valueOf: () => 1000 },
          dailyLimitMessage: 0,
          whatsappBusinessAccountId: data.whatsappBusinessAccountId,
          whatsappPhoneId: data.whatsappPhoneId,
          whatsappApplicationId: data.whatsappApplicationId,
          callbackUrl: data.callbackUrl,
          expiredAt: null,
          whatsappProfile: data.whatsappProfile,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
        }
      })

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
            displayName: "Primary Device",
            environment: "LIVE",
            whatsappBusinessAccountId: "waba-1",
            whatsappPhoneId: "phone-1",
            whatsappApplicationId: "app-1",
            callbackUrl: "https://example.com/cb",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(capturedData).toEqual(
        expect.objectContaining({
          organizationId: "org-1",
          phoneNumber: "+6281234567890",
          status: "ACTIVE",
          whatsappBusinessAccountId: "waba-1",
          whatsappPhoneId: "phone-1",
          whatsappApplicationId: "app-1",
          callbackUrl: "https://example.com/cb",
          whatsappProfile: { name: "Primary Device" },
        })
      )
    })

    it("returns 500 on service failure", async () => {
      mockCreate.mockImplementation(async () => {
        throw new Error("Database exploded")
      })

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  // ─── POST /:id/top-up ──────────────────────────────────────────────────────

  describe("POST /:id/top-up", () => {
    it("returns 401 when not authenticated", async () => {
      unauthorizedContext()

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, reason: "Test" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 422 when amount is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 when amount is zero", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 0, reason: "Test" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockImplementation(async () => null)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/nonexistent/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, reason: "Test top-up" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 400 when balance would exceed max", async () => {
      mockFindUnique.mockImplementation(async () => ({
        id: "dev-1",
        organizationId: "org-1",
        balance: { plus: () => ({ gt: () => true }) },
      }))
      mockBillingFindUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: 0,
      }))

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 500000000, reason: "Excessive" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("BALANCE_LIMIT_EXCEEDED")
    })

    it("successfully tops up device balance", async () => {
      const balanceObj = {
        value: 50000,
        plus: function (n: number) {
          this.value += n
          return { gt: () => false, toString: () => String(this.value) }
        },
        toString: () => "50000",
        valueOf: () => 50000,
      }
      const fakeDevice = {
        id: "dev-1",
        organizationId: "org-1",
        balance: balanceObj,
      }
      mockFindUnique.mockImplementation(async () => fakeDevice)
      mockBillingFindUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: 0,
      }))
      mockUpdate.mockImplementation(async () => ({
        ...fakeDevice,
        balance: { toString: () => "150000", valueOf: () => 150000 },
      }))

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, reason: "Monthly top-up" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.newBalance).toBe(150000)
      expect(body.amount).toBe(50000)
    })
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `bun run test modules/whatsapp/devices/api/admin-devices.route.test.ts 2>&1 | tail -20`
Expected: all tests pass (new tests included).

- [ ] **Step 3: Run lint + typecheck**

Run: `bun run lint 2>&1 | tail -5; bun run typecheck 2>&1 | tail -5`
Expected: 0 errors each.

- [ ] **Step 4: Commit**

```bash
git add modules/whatsapp/devices/api/admin-devices.route.test.ts
git commit -m "test(admin-devices): rewrite tests for requireSuperAdmin + POST / coverage"
```

---

## Task 5: Add `listAdminOrganizations()` to admin service

**Files:**
- Modify: `modules/admin/admin.service.ts`

- [ ] **Step 1: Add the helper at the bottom of the file**

Append after the `sendAdminInvitation` function (line 105):

```ts
export const listAdminOrganizations = async (): Promise<
  Array<Pick<AdminOrganizationSummary, "id" | "name" | "createdAt">>
> => {
  const workos = getWorkOS()
  const response = await workos.organizations.listOrganizations({
    limit: 100,
  })
  return response.data.map((org) => ({
    id: org.id,
    name: org.name,
    createdAt: org.createdAt,
  }))
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add modules/admin/admin.service.ts
git commit -m "feat(admin): add listAdminOrganizations() helper"
```

---

## Task 6: Add `GET /admin/organizations` to admin orgs route

**Files:**
- Modify: `modules/admin/api/routes/admin-organizations.route.ts`

- [ ] **Step 1: Add the GET handler**

Replace the file with:

```ts
import { Elysia } from "elysia"

import { adminCreateOrganizationSchema } from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import {
  createAdminOrganization,
  listAdminOrganizations,
} from "@/modules/admin/admin.service"

export const createAdminOrganizationsRoutes = (deps = {}) => {
  const {
    requireSuperAdmin: guard = requireSuperAdmin,
  } = { ...deps }

  return new Elysia()
    .get("/admin/organizations", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const organizations = await listAdminOrganizations()
        return { ok: true as const, organizations }
      } catch (error) {
        console.error(
          "[AdminOrganizations] List error:",
          error
        )
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to list organizations.",
        }
      }
    })
    .post(
      "/admin/organizations",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const org = await createAdminOrganization({
            name: body.name.trim(),
            domains: body.domains?.map((d: string) => d.trim()),
            externalId: body.externalId?.trim(),
          })

          set.status = 201
          return {
            ok: true,
            organization: org,
          }
        } catch (error) {
          return toWorkosError(set, error)
        }
      },
      { body: adminCreateOrganizationSchema }
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add modules/admin/api/routes/admin-organizations.route.ts
git commit -m "feat(admin): add GET /admin/organizations endpoint"
```

---

## Task 7: Add `admin-organizations.route.test.ts`

**Files:**
- Create: `modules/admin/api/routes/admin-organizations.route.test.ts`

- [ ] **Step 1: Create the test file**

```ts
/**
 * Admin Organizations — Routes Tests
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockListOrganizations = mock<(...args: any[]) => any>(async () => ({
  data: [
    {
      id: "org-1",
      name: "Acme Inc",
      createdAt: "2025-01-01T00:00:00.000Z",
    },
    {
      id: "org-2",
      name: "Globex Corp",
      createdAt: "2025-01-02T00:00:00.000Z",
    },
  ],
}))

const mockGetWorkOS = mock<(...args: any[]) => any>(() => ({
  organizations: {
    listOrganizations: mockListOrganizations,
  },
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: mockGetWorkOS,
}))

const mockRequireSuperAdmin = mock<(...args: any[]) => any>(async () => ({
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

// Module under test
const { createAdminOrganizationsRoutes } = await import(
  "./admin-organizations.route"
)

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestApp() {
  return new Elysia().use(createAdminOrganizationsRoutes())
}

const BASE = "http://localhost/admin/organizations"

function unauthorizedContext() {
  mockRequireSuperAdmin.mockImplementation((set: any) => {
    set.status = 401
    return {
      ok: false as const,
      error: "UNAUTHORIZED" as const,
      message: "You must be signed in to perform this action.",
    }
  })
}

function forbiddenContext() {
  mockRequireSuperAdmin.mockImplementation((set: any) => {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      policyCode: "SUPER_ADMIN_REQUIRED" as const,
      message: "This action requires super admin access.",
    }
  })
}

function superAdminContext() {
  mockRequireSuperAdmin.mockImplementation(async () => ({
    userId: "admin-1",
    platformRole: "super_admin" as const,
  }))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Admin Organizations Routes", () => {
  beforeEach(() => {
    mockListOrganizations.mockImplementation(async () => ({
      data: [
        {
          id: "org-1",
          name: "Acme Inc",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "org-2",
          name: "Globex Corp",
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ],
    }))
    superAdminContext()
  })

  // ─── GET /admin/organizations ───────────────────────────────────────────────

  describe("GET /admin/organizations", () => {
    it("returns 401 when not authenticated", async () => {
      unauthorizedContext()

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      forbiddenContext()

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}`))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.policyCode).toBe("SUPER_ADMIN_REQUIRED")
    })

    it("returns organization list when super admin", async () => {
      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.organizations).toHaveLength(2)
      expect(body.organizations[0]).toEqual({
        id: "org-1",
        name: "Acme Inc",
        createdAt: "2025-01-01T00:00:00.000Z",
      })
      expect(body.organizations[1].id).toBe("org-2")
    })

    it("returns 500 when WorkOS throws", async () => {
      mockListOrganizations.mockImplementation(async () => {
        throw new Error("WorkOS down")
      })

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}`))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
```

- [ ] **Step 2: Run the new tests**

Run: `bun run test modules/admin/api/routes/admin-organizations.route.test.ts 2>&1 | tail -15`
Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add modules/admin/api/routes/admin-organizations.route.test.ts
git commit -m "test(admin-organizations): add GET /admin/organizations tests"
```

---

## Task 8: Add `Add Device` button + dialog to admin page

**Files:**
- Modify: `app/[lang]/admin/whatsapp/devices/page.tsx`

- [ ] **Step 1: Replace the file with the dialog-enabled version**

The full new content of `app/[lang]/admin/whatsapp/devices/page.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import {
  Phone,
  ArrowsClockwise,
  WarningCircle,
  Plus,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

type AdminDevice = {
  id: string
  organizationId: string
  phoneNumber: string
  status: string
  balance: number
  quotaBase: number
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  whatsappApplicationId: string | null
  callbackUrl: string | null
  whatsappProfile: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

type AdminOrganization = {
  id: string
  name: string
  createdAt: string
}

type DeviceEnvironment = "SANDBOX" | "LIVE"

type AddFormState = {
  organizationId: string
  phoneNumber: string
  displayName: string
  environment: DeviceEnvironment
  whatsappBusinessAccountId: string
  whatsappPhoneId: string
  whatsappApplicationId: string
  callbackUrl: string
}

const emptyAddForm: AddFormState = {
  organizationId: "",
  phoneNumber: "",
  displayName: "",
  environment: "LIVE",
  whatsappBusinessAccountId: "",
  whatsappPhoneId: "",
  whatsappApplicationId: "",
  callbackUrl: "",
}

const deviceDisplayName = (
  profile: Record<string, unknown> | null,
  fallback: string
): string => {
  if (profile && typeof profile.name === "string" && profile.name.length > 0) {
    return profile.name
  }
  return fallback
}

export default function AdminDevicesPage() {
  const [devices, setDevices] = React.useState<AdminDevice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [organizations, setOrganizations] = React.useState<AdminOrganization[]>(
    []
  )
  const [orgsLoading, setOrgsLoading] = React.useState(true)

  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [addForm, setAddForm] = React.useState<AddFormState>(emptyAddForm)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadDevices = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/devices")
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to load devices.")
      }

      setDevices(body.devices)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrganizations = React.useCallback(async () => {
    setOrgsLoading(true)
    try {
      const res = await fetch("/api/admin/organizations")
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to load organizations.")
      }

      setOrganizations(body.organizations)
    } catch (err) {
      console.error("[AdminDevices] org fetch error:", err)
      setOrganizations([])
    } finally {
      setOrgsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void (async () => {
      await loadDevices()
    })()
  }, [loadDevices])

  React.useEffect(() => {
    void (async () => {
      await loadOrganizations()
    })()
  }, [loadOrganizations])

  const openAddDialog = () => {
    setAddForm({
      ...emptyAddForm,
      organizationId: organizations[0]?.id ?? "",
    })
    setAddDialogOpen(true)
  }

  const handleAddDevice = async () => {
    if (!addForm.organizationId) {
      toast.error("Please choose an organization.")
      return
    }
    if (!addForm.phoneNumber.trim()) {
      toast.error("Phone number is required.")
      return
    }

    setIsSubmitting(true)

    const payload: Record<string, unknown> = {
      organizationId: addForm.organizationId,
      phoneNumber: addForm.phoneNumber.trim(),
      environment: addForm.environment,
    }

    if (addForm.displayName.trim()) {
      payload.displayName = addForm.displayName.trim()
    }
    if (addForm.whatsappBusinessAccountId.trim()) {
      payload.whatsappBusinessAccountId =
        addForm.whatsappBusinessAccountId.trim()
    }
    if (addForm.whatsappPhoneId.trim()) {
      payload.whatsappPhoneId = addForm.whatsappPhoneId.trim()
    }
    if (addForm.whatsappApplicationId.trim()) {
      payload.whatsappApplicationId = addForm.whatsappApplicationId.trim()
    }
    if (addForm.callbackUrl.trim()) {
      payload.callbackUrl = addForm.callbackUrl.trim()
    }

    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json()

      if (!res.ok || !body.ok) {
        const message =
          body?.fieldErrors?.organizationId?.[0] ??
          body?.fieldErrors?.phoneNumber?.[0] ??
          body?.message ??
          "Failed to create device."
        throw new Error(message)
      }

      toast.success("Device created successfully.")
      setAddDialogOpen(false)
      setAddForm(emptyAddForm)
      void loadDevices()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create device."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Devices (Admin)
          </h1>
          <p className="text-muted-foreground">
            Manage all WhatsApp devices across organizations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>Loading device list...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Devices (Admin)
          </h1>
          <p className="text-muted-foreground">
            Manage all WhatsApp devices across organizations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>Device list</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WarningCircle className="mb-3 size-10 text-destructive" />
              <p className="mb-2 text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button variant="outline" onClick={() => void loadDevices()}>
                <ArrowsClockwise className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices (Admin)</h1>
        <p className="text-muted-foreground">
          Manage all WhatsApp devices across organizations.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>
              {devices.length} device{devices.length !== 1 ? "s" : ""} found
            </CardDescription>
          </div>
          <Button onClick={openAddDialog}>
            <Plus weight="bold" className="mr-2 size-4" />
            Add Device
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No devices found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a device on behalf of any organization.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={openAddDialog}
              >
                Add your first device
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <Link
                      href={`/admin/whatsapp/devices/${device.id}`}
                      className="font-medium hover:underline"
                    >
                      {deviceDisplayName(
                        device.whatsappProfile,
                        device.phoneNumber
                      )}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {device.phoneNumber} &middot; Org:{" "}
                      <code className="rounded bg-muted px-1 text-xs">
                        {device.organizationId.slice(0, 12)}...
                      </code>{" "}
                      &middot; Balance:{" "}
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(device.balance)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      device.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {device.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add Device Dialog ──────────────────────────────────────────── */}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add WhatsApp Device</DialogTitle>
            <DialogDescription>
              Create a device on behalf of an organization. All WA Business
              Account fields are optional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-org">Organization</Label>
              <Select
                value={addForm.organizationId}
                onValueChange={(value) =>
                  setAddForm({ ...addForm, organizationId: value })
                }
                disabled={orgsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      orgsLoading
                        ? "Loading organizations..."
                        : "Select organization"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone Number</Label>
              <Input
                id="add-phone"
                value={addForm.phoneNumber}
                onChange={(e) =>
                  setAddForm({ ...addForm, phoneNumber: e.target.value })
                }
                placeholder="+6281234567890"
                inputMode="tel"
                autoComplete="tel"
                required
                aria-required="true"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-display-name">WhatsApp Display Name</Label>
              <Input
                id="add-display-name"
                value={addForm.displayName}
                onChange={(e) =>
                  setAddForm({ ...addForm, displayName: e.target.value })
                }
                placeholder="Primary device"
                maxLength={120}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-environment">Environment</Label>
              <Select
                value={addForm.environment}
                onValueChange={(value) =>
                  setAddForm({
                    ...addForm,
                    environment: value as DeviceEnvironment,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIVE">Live</SelectItem>
                  <SelectItem value="SANDBOX">Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-waba">WA Business Account ID</Label>
              <Input
                id="add-waba"
                value={addForm.whatsappBusinessAccountId}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    whatsappBusinessAccountId: e.target.value,
                  })
                }
                placeholder="Optional"
                maxLength={64}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-wa-phone">WA Phone ID</Label>
              <Input
                id="add-wa-phone"
                value={addForm.whatsappPhoneId}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    whatsappPhoneId: e.target.value,
                  })
                }
                placeholder="Optional"
                maxLength={64}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-wa-app">WA Application ID</Label>
              <Input
                id="add-wa-app"
                value={addForm.whatsappApplicationId}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    whatsappApplicationId: e.target.value,
                  })
                }
                placeholder="Optional"
                maxLength={64}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-callback">Callback URL</Label>
              <Input
                id="add-callback"
                type="url"
                value={addForm.callbackUrl}
                onChange={(e) =>
                  setAddForm({ ...addForm, callbackUrl: e.target.value })
                }
                placeholder="https://example.com/webhook"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false)
                setAddForm(emptyAddForm)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddDevice()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run typecheck 2>&1 | tail -10; bun run lint 2>&1 | tail -10`
Expected: 0 errors each.

- [ ] **Step 3: Commit**

```bash
git add 'app/[lang]/admin/whatsapp/devices/page.tsx'
git commit -m "feat(admin-ui): add Add Device button + dialog on admin devices page"
```

---

## Task 9: Update `FEATURES.md` section 3.2

**Files:**
- Modify: `FEATURES.md`

- [ ] **Step 1: Find the section 3.2 admin device oversight row**

In the repo root, `FEATURES.md` contains (somewhere in the WhatsApp section):

```
| Admin device oversight | ✓ `admin-devices.route` | - | ✓ Admin WhatsApp |
```

Replace that single row with:

```
| Admin device oversight (read + top-up + create) | ✓ `admin-devices.route` | - | ✓ Admin WhatsApp |
```

- [ ] **Step 2: Find and update the feature spec annotation**

Further down in the same section there is a line similar to:

```
> **📋 Feature Spec:** [`_features/admin-whatsapp-device-onboarding.md`](./_features/admin-whatsapp-device-onboarding.md) - gap Admin device onboarding flow: missing `POST /admin/devices`, `PATCH`, `DELETE` endpoints, dan UI dialog untuk `/whatsapp/devices`.
```

Update it to:

```
> **📋 Feature Spec:** [`_features/admin-whatsapp-device-onboarding.md`](./_features/admin-whatsapp-device-onboarding.md) - Admin device onboarding flow with `POST /admin/devices`, `GET /admin/organizations`, and UI dialog for `/whatsapp/devices`. PATCH and DELETE remain follow-up work.
```

- [ ] **Step 3: Commit**

```bash
git add FEATURES.md
git commit -m "docs(features): mark admin device create flow as complete"
```

---

## Task 10: 4-pillar validation

- [ ] **Step 1: Lint**

Run: `bun run lint 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 3: Tests**

Run: `bun run test 2>&1 | tail -10`
Expected: 1218 (baseline) + new tests pass, 0 fail.

- [ ] **Step 4: Coverage**

Run: `bun run test:coverage 2>&1 | tail -15`
Expected: coverage report shows acceptable line coverage. New route files should be at or above the project average.

- [ ] **Step 5: Build**

Run: `bun run build 2>&1 | tail -20`
Expected: production build succeeds.

- [ ] **Step 6: If any pillar fails, fix and re-run before commit**

If lint/typecheck/test/build fails, fix the issue, commit the fix as a separate commit, then re-run the full pillar suite.

---

## Task 11: Manual smoke test against `bun run dev`

- [ ] **Step 1: Start dev server**

In one terminal:
```bash
bun run dev
```
Server: `http://localhost:3300`

- [ ] **Step 2: Sign in as super admin and exercise the new flow**

Walkthrough:
1. Open `http://localhost:3300/admin/whatsapp/devices` in a browser signed in as super admin
2. Click "Add Device" — dialog opens
3. Confirm organization dropdown is populated (loads `GET /api/admin/organizations`)
4. Fill phone number `+6289999999999`, environment `LIVE`, display name "Test"
5. Submit — expect success toast, dialog closes, new device appears in the list with "Test" as the link text
6. Open `/admin/whatsapp/devices/{newId}` — confirm WA Business Account fields are empty (or filled if you set them)

- [ ] **Step 3: API checks with curl**

```bash
# 401 when not signed in
curl -i http://localhost:3300/api/admin/organizations

# 200 when signed in as super admin
# (use cookie from browser DevTools)
curl -i -H "Cookie: wos-session=$WOS_SESSION_COOKIE" http://localhost:3300/api/admin/organizations

# POST create device
curl -i -X POST http://localhost:3300/api/admin/devices \
  -H "Cookie: wos-session=$WOS_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org_xxx","phoneNumber":"+628111111111","displayName":"Smoke","environment":"LIVE"}'

# Missing organizationId -> 422
curl -i -X POST http://localhost:3300/api/admin/devices \
  -H "Cookie: wos-session=$WOS_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+628111111111"}'
```

Expected: 201, 200, 422 respectively.

- [ ] **Step 4: Document any deviations**

If anything does not work as expected, fix the code (commit separately) and re-run the smoke.

---

## Task 12: Final commit and PR

- [ ] **Step 1: Confirm all commits are in place**

Run: `git log --oneline main..HEAD`
Expected: 8-9 feature commits + this plan = no uncommitted changes.

- [ ] **Step 2: Push branch and open PR**

```bash
git push -u origin feat/pgreen-045-admin-whatsapp-device-onboarding
gh pr create \
  --title "feat(whatsapp): admin device onboarding (PGREEN-045)" \
  --body-file docs/superpowers/plans/2026-06-03-pgreen-045-admin-whatsapp-device-onboarding.md \
  --base main
```

In the PR body, include:
- Problem: admin cannot create devices on behalf of orgs
- Solution: POST /admin/devices + GET /admin/organizations + dialog
- Tests: 4-pillar results (paste from Task 10)
- Manual smoke result
- Linked issue / task: PGREEN-045

- [ ] **Step 3: Wait for CI and address feedback per the PR review loop in AGENTS.md**

- [ ] **Step 4: Merge once approved**

---

## Self-Review Notes (already applied)

- **Spec coverage:** every section of the design spec maps to a task (1-9 = backend; 8-9 = UI + docs; 10-12 = validation + delivery).
- **Placeholder scan:** every step has the actual code or command. No "TBD", "TODO", "appropriate error handling", "fill in details".
- **Type consistency:**
  - `CreateDeviceInput` is widened in Task 1 and consumed in Task 2 (`input.whatsappBusinessAccountId`, `input.displayName`, etc.).
  - `adminCreateDeviceSchema` is exported in Task 1, imported in Task 3.
  - `requireSuperAdmin` mock helper is defined once per test file and reused by `unauthorizedContext` / `forbiddenContext` / `superAdminContext`.
  - `listAdminOrganizations` is exported in Task 5, imported in Task 6.
  - `AdminDevice` type in the page includes `whatsappProfile` (used by `deviceDisplayName`).
  - `addForm.organizationId` defaults to first org id on dialog open.
- **Risks called out in spec:** all four are addressed (displayName storage, 100-org limit, name-column deferred, console flow untouched).
