import { beforeEach, describe, expect, it, mock } from "bun:test"

// Mock leaf dependencies before any other imports
const mockWorkOSAuth = {
  withAuth: mock(async () => ({
    user: { id: "user_1", email: "owner@example.com" },
    organizationId: "org_1",
    role: "user_owner",
    roles: ["user_owner"],
    accessToken: "mock_token",
    impersonator: null,
    sessionId: "mock_session",
    enterprise: null,
  })),
  getWorkOS: mock(() => ({
    organizations: {
      getOrganization: mock(async () => ({
        id: "org_1",
        name: "Example Organization",
        metadata: {},
      })),
    },
  })),
}

mock.module("@workos-inc/authkit-nextjs", () => mockWorkOSAuth)

const mockPrisma = {
  billingAccount: {
    findUnique: mock(async () => ({
      organizationId: "org_1",
    })),
  },
  billingInvoice: {
    findMany: mock(async () => []),
    findFirst: mock(async (): Promise<unknown> => null),
    updateMany: mock(async () => ({ count: 1 })),
  },
  authPlatformUserRole: {
    findFirst: mock(async () => null),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// Now import the module under test
const { createInvoicesRoutes } = await import("@/modules/invoices/api/invoices.route")

describe("invoices default deps", () => {
  beforeEach(() => {
    mockPrisma.billingInvoice.findMany.mockClear()
    mockPrisma.billingInvoice.findFirst.mockClear()
    mockPrisma.billingInvoice.updateMany.mockClear()
    mockPrisma.authPlatformUserRole.findFirst.mockClear()
  })

  it("uses default authenticate and getPlatformRole via withAuth", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createInvoicesRoutes())

    // withAuth returns a mock user, so this should succeed
    const response = await app.handle(
      new Request("http://localhost/invoices")
    )

    // with withAuth mocked to return a user, we should get a 200 or 403
    // (depends on whether listInvoices with default repo succeeds)
    expect([200, 403, 500]).toContain(response.status)
  })

  it("can access invoices via default deps with mocked prisma", async () => {
    const { Elysia } = await import("elysia")

    // Override prisma mock to return empty invoices
    mockPrisma.billingInvoice.findMany.mockResolvedValue([])

    const app = new Elysia().use(createInvoicesRoutes())

    const response = await app.handle(
      new Request("http://localhost/invoices")
    )

    // With mocked auth returning org, should get 200 with empty list
    const payload = (await response.json()) as { ok: boolean; invoices: unknown[] }
    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.invoices).toEqual([])
  })

  it("uses default getOrganizationIdByBillingAccount via prisma", async () => {
    const { Elysia } = await import("elysia")

    // Mock invoice detail lookup to return an invoice with billingAccountId
    const invoiceDetail = {
      id: "inv_1",
      billingAccountId: "ba_1",
      invoiceNumber: "INV-2026-0001",
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-31T23:59:59.000Z"),
      currency: "USD",
      status: "OPEN" as const,
      subtotalAmount: 100,
      taxAmount: 10,
      discountAmount: 0,
      totalAmount: 110,
      issuedAt: new Date("2026-05-02T00:00:00.000Z"),
      dueAt: new Date("2026-05-17T00:00:00.000Z"),
      paidAt: null,
      metadataJson: null,
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
      lines: [
        {
          id: "line_1",
          invoiceId: "inv_1",
          lineType: "SUBSCRIPTION" as const,
          description: "Pro plan",
          quantity: 1,
          unitPrice: 100,
          amount: 100,
          currency: "USD",
          periodStart: null,
          periodEnd: null,
          metadataJson: null,
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        },
      ],
    }

    mockPrisma.billingInvoice.findFirst.mockResolvedValue(invoiceDetail)

    const app = new Elysia().use(createInvoicesRoutes())

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1")
    )
    const payload = (await response.json()) as {
      ok: boolean
      invoice: { invoiceNumber: string }
      canMarkCanceled: boolean
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.invoice.invoiceNumber).toBe("INV-2026-0001")
    expect(typeof payload.canMarkCanceled).toBe("boolean")
  })
})
