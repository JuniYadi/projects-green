import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock auth ─────────────────────────────────────────────

let mockAuthValue: {
  user: { id: string; email: string } | null
  organizationId: string | null
} = {
  user: { id: "user-1", email: "test@example.com" },
  organizationId: "org-1",
}

const mockWithAuth = mock(async () => mockAuthValue)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

// ── Mock prisma ────────────────────────────────────────────

type MockVal = Record<string, unknown> | null

const mockBillingInvoiceFindFirst = mock(
  (): Promise<MockVal> => Promise.resolve(null)
)
const mockPaymentConfirmationFindFirst = mock(
  (): Promise<MockVal> => Promise.resolve(null)
)
const mockPaymentConfirmationCreate = mock(() => Promise.resolve({}))

const mockPrisma = {
  billingInvoice: {
    findFirst: mockBillingInvoiceFindFirst,
  },
  paymentConfirmation: {
    findFirst: mockPaymentConfirmationFindFirst,
    create: mockPaymentConfirmationCreate,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// ── Import route after mocks ───────────────────────────────

const { createConfirmRoutes } = await import("./confirm.route")

// ── Tests ─────────────────────────────────────────────────

describe("ConfirmRoute POST /topup/confirm/:id", () => {
  beforeEach(() => {
    mockBillingInvoiceFindFirst.mockClear()
    mockPaymentConfirmationFindFirst.mockClear()
    mockPaymentConfirmationCreate.mockClear()
    mockAuthValue = {
      user: { id: "user-1", email: "test@example.com" },
      organizationId: "org-1",
    }
    // Default: invoice is open — route + service each call findFirst once
    mockBillingInvoiceFindFirst.mockResolvedValue({
      id: "inv-1",
      status: "OPEN",
      totalAmount: { toNumber: () => 100000 },
    })
  })

  it("returns 409 when pending confirmation already exists", async () => {
    mockPaymentConfirmationFindFirst.mockResolvedValueOnce({
      id: "conf-existing",
      status: "PENDING",
      invoiceId: "inv-1",
    })

    const app = new Elysia().use(createConfirmRoutes()).compile()
    const res = await app.handle(
      new Request("http://localhost/topup/confirm/inv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date().toISOString(),
        }),
      })
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("DUPLICATE_CONFIRMATION")
  })

  it("returns 409 when invoice already paid", async () => {
    mockPaymentConfirmationFindFirst.mockResolvedValueOnce({
      id: "conf-approved",
      status: "APPROVED",
      invoiceId: "inv-1",
    })

    const app = new Elysia().use(createConfirmRoutes()).compile()
    const res = await app.handle(
      new Request("http://localhost/topup/confirm/inv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date().toISOString(),
        }),
      })
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVOICE_ALREADY_PAID")
  })

  it("returns 200 when no duplicate exists", async () => {
    mockPaymentConfirmationFindFirst.mockResolvedValueOnce(null)
    mockPaymentConfirmationCreate.mockResolvedValueOnce({
      id: "conf-new",
      status: "PENDING",
      invoiceId: "inv-1",
      createdAt: new Date(),
    })

    const app = new Elysia().use(createConfirmRoutes()).compile()
    const res = await app.handle(
      new Request("http://localhost/topup/confirm/inv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date().toISOString(),
        }),
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.confirmation.status).toBe("PENDING")
    // Security: route-level invoice lookup must be scoped to the caller's org.
    const calls = mockBillingInvoiceFindFirst.mock.calls as Array<
      [
        {
          where?: { id?: string; billingAccount?: { organizationId?: string } }
        },
      ]
    >
    const orgScopedCall = calls.find(
      (call) =>
        call[0]?.where?.billingAccount?.organizationId === "org-1" &&
        call[0]?.where?.id === "inv-1"
    )
    expect(orgScopedCall).toBeDefined()
  })

  it("returns 401 when no organization", async () => {
    mockAuthValue = {
      user: { id: "user-1", email: "test@example.com" },
      organizationId: null,
    }

    const app = new Elysia().use(createConfirmRoutes()).compile()
    const res = await app.handle(
      new Request("http://localhost/topup/confirm/inv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date().toISOString(),
        }),
      })
    )

    expect(res.status).toBe(401)
  })
})
