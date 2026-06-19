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

const mockInvoice = {
  id: "inv-1",
  invoiceNumber: "INV-2026-05-001",
  status: "DRAFT",
  subtotalAmount: new Decimal("100000.00"),
  taxAmount: new Decimal("0.00"),
  discountAmount: new Decimal("0.00"),
  totalAmount: new Decimal("100000.00"),
  currency: "IDR",
  issuedAt: null as Date | null,
  dueAt: new Date("2026-06-15"),
  paidAt: null as Date | null,
  createdAt: new Date("2026-06-01"),
}

const mockFindUnique = mock(async () => mockInvoice)
const mockUpdate = mock(async () => ({
  ...mockInvoice,
  status: "ISSUED",
  issuedAt: new Date(),
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    platformUserRole: {
      findFirst: mockPlatformRoleFindFirst,
    },
    billingInvoice: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

const { createAdminInvoiceRoutes } = await import("./invoice.route")

describe("admin invoice default deps", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("uses default authenticate and isAdmin from default deps", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createAdminInvoiceRoutes())

    const response = await app.handle(
      new Request("http://localhost/admin/invoices/inv-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ISSUED" }),
      })
    )

    // With super_admin role, should pass isAdmin check and update invoice
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.invoice.status).toBe("ISSUED")
  })

  it("uses default deps to cancel invoice (ISSUED -> CANCELLED)", async () => {
    const { Elysia } = await import("elysia")

    mockFindUnique.mockResolvedValueOnce({
      ...mockInvoice,
      status: "ISSUED",
      issuedAt: new Date("2026-06-01"),
    })
    mockUpdate.mockResolvedValueOnce({
      ...mockInvoice,
      status: "CANCELLED",
      issuedAt: new Date("2026-06-01"),
    })

    const app = new Elysia().use(createAdminInvoiceRoutes())

    const response = await app.handle(
      new Request("http://localhost/admin/invoices/inv-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.invoice.status).toBe("CANCELLED")
  })
})
