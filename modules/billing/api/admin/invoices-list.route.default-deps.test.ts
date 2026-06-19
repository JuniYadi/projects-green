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

const mockFindMany = mock<
  () => Promise<
    Array<{
      id: string
      invoiceNumber: string
      status: string
      subtotalAmount: unknown
      taxAmount: unknown
      discountAmount: unknown
      totalAmount: unknown
      currency: string
      issuedAt: Date | null
      dueAt: Date
      paidAt: null
      createdAt: Date
      billingAccount: { organizationId: string }
    }>
  >
>(async () => [])
const mockCount = mock<() => Promise<number>>(async () => 0)

mock.module("@/lib/prisma", () => ({
  prisma: {
    platformUserRole: {
      findFirst: mockPlatformRoleFindFirst,
    },
    billingInvoice: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}))

const { createAdminInvoicesListRoutes } = await import("./invoices-list.route")

describe("admin invoices list default deps", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("uses default authenticate and isAdmin from default deps", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createAdminInvoicesListRoutes())

    const response = await app.handle(
      new Request("http://localhost/admin/invoices")
    )

    // With super_admin role, should pass isAdmin check
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it("returns invoices with pagination using default deps", async () => {
    const { Elysia } = await import("elysia")

    mockFindMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        invoiceNumber: "INV-2026-05-001",
        status: "ISSUED",
        subtotalAmount: new Decimal("100000.00"),
        taxAmount: new Decimal("0.00"),
        discountAmount: new Decimal("0.00"),
        totalAmount: new Decimal("100000.00"),
        currency: "IDR",
        issuedAt: new Date("2026-06-01"),
        dueAt: new Date("2026-06-15"),
        paidAt: null,
        createdAt: new Date("2026-06-01"),
        billingAccount: { organizationId: "org-1" },
      },
    ])
    mockCount.mockResolvedValueOnce(1)

    const app = new Elysia().use(createAdminInvoicesListRoutes())

    const response = await app.handle(
      new Request("http://localhost/admin/invoices")
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.invoices).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })
})
