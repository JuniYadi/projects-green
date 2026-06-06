import { beforeEach, describe, expect, it, mock } from "bun:test"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

// Mock leaf dependencies before any other imports
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({
    user: { id: "user_1", email: "admin@example.com" },
    organizationId: "org_1",
    role: "admin",
    roles: ["admin"],
    accessToken: "mock_token",
    impersonator: null,
    sessionId: "mock_session",
    enterprise: null,
  })),
}))

const mockPlatformRoleFindFirst = mock(async () => ({
  id: "role_1",
  workosUserId: "user_1",
  role: "super_admin",
}))

const mockFindMany = mock<() => Promise<Array<{ id: string; billingAccountId: string; adjustmentType: string; amount: unknown; currency: string; reason: string; createdByWorkosUserId: string; createdAt: Date; updatedAt: Date; billingAccount: { organizationId: string } }>>>(async () => [])
const mockCount = mock<() => Promise<number>>(async () => 0)

mock.module("@/lib/prisma", () => ({
  prisma: {
    platformUserRole: {
      findFirst: mockPlatformRoleFindFirst,
    },
    billingAdjustment: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}))

const { createAdminAdjustmentsRoutes } = await import("./adjustments.route")

describe("admin adjustments default deps", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("uses default authenticate and isAdmin from default deps", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createAdminAdjustmentsRoutes())

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments"),
    )

    // With super_admin role, should pass isAdmin check
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it("returns adjustments with pagination using default deps", async () => {
    const { Elysia } = await import("elysia")

    mockFindMany.mockResolvedValueOnce([
      {
        id: "adj-1",
        billingAccountId: "acc-1",
        adjustmentType: "CREDIT",
        amount: new Decimal("50000.00"),
        currency: "IDR",
        reason: "Test credit",
        createdByWorkosUserId: "admin-1",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
        billingAccount: {
          organizationId: "org-1",
        },
      },
    ])
    mockCount.mockResolvedValueOnce(1)

    const app = new Elysia().use(createAdminAdjustmentsRoutes())

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments"),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.adjustments).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })
})
