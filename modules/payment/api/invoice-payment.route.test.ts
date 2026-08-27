import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
// ── Mock auth ───────────────────────────────────────────

let mockAuthValue: {
  user: { id: string; email: string } | null
  organizationId?: string
} = {
  user: null,
}

const mockWithAuth = mock(async () => mockAuthValue)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
  getWorkOS: () => ({ organizations: {}, userManagement: {} }),
}))

// ── Mock prisma ─────────────────────────────────────────

const mockBillingInvoiceFindFirst = mock()
const mockBillingAccountFindUnique = mock()

const mockPrisma = {
  billingInvoice: {
    findFirst: mockBillingInvoiceFindFirst,
  },
  billingAccount: {
    findUnique: mockBillingAccountFindUnique,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// ── Mock PaymentService ─────────────────────────────────

const mockPayWithBalance = mock()
const mockCreateTopupInvoiceForGap = mock()

mock.module("../services/payment.service", () => ({
  PaymentService: class {
    payWithBalance = mockPayWithBalance
    createTopupInvoiceForGap = mockCreateTopupInvoiceForGap
  },
}))

// ── Import route after mocks ────────────────────────────

const { createInvoicePaymentRoutes } = await import("./invoice-payment.route")

function app() {
  return new Elysia().use(createInvoicePaymentRoutes()).compile()
}

describe("InvoicePaymentRoute POST /invoice/pay-with-balance", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPayWithBalance.mockReset()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuthValue = { user: null }

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when user has no active organization", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: undefined,
    }

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
  })

  it("returns 422 for invalid body payload", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "" }),
      })
    )

    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("VALIDATION_ERROR")
    expect(json.fieldErrors).toBeDefined()
  })

  it("returns 200 when payment succeeds", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockPayWithBalance.mockResolvedValueOnce(undefined)

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.message).toBe("Invoice paid successfully.")
    expect(mockPayWithBalance).toHaveBeenCalledWith("inv-123", "org-1")
  })

  it("returns 400 when invoice is not found or not open", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockPayWithBalance.mockRejectedValueOnce(
      new Error("Invoice not found or not open")
    )

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("PAYMENT_FAILED")
    expect(json.message).toBe("Invoice not found or not open")
  })

  it("returns 400 when balance is insufficient", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockPayWithBalance.mockRejectedValueOnce(new Error("Insufficient balance"))

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("PAYMENT_FAILED")
    expect(json.message).toBe("Insufficient balance")
  })

  it("returns 404 when billing account is not found", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockPayWithBalance.mockRejectedValueOnce(
      new Error("Billing account not found")
    )

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
    expect(json.message).toBe("Billing account not found")
  })

  it("returns 500 on unhandled error", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockPayWithBalance.mockRejectedValueOnce(
      new Error("Database connection lost")
    )

    const res = await app().handle(
      new Request("http://localhost/invoice/pay-with-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INTERNAL_SERVER_ERROR")
  })
})

describe("InvoicePaymentRoute POST /invoice/topup-and-pay", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockBillingInvoiceFindFirst.mockReset()
    mockBillingAccountFindUnique.mockReset()
    mockPayWithBalance.mockReset()
    mockCreateTopupInvoiceForGap.mockReset()
  })

  it("returns 401 when not signed in", async () => {
    mockAuthValue = { user: null }

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when no organizationId", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: undefined,
    }

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
  })

  it("returns 422 for validation error", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    )

    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("VALIDATION_ERROR")
  })

  it("returns 404 when invoice is not found or not open", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockBillingInvoiceFindFirst.mockResolvedValueOnce(null)

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
    expect(json.message).toBe("Invoice not found or not open.")
  })

  it("returns 404 when billing account is not found", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockBillingInvoiceFindFirst.mockResolvedValueOnce({
      id: "inv-123",
      totalAmount: new Decimal(100000),
    })
    mockBillingAccountFindUnique.mockResolvedValueOnce(null)

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
    expect(json.message).toBe("Billing account not found.")
  })

  it("pays with existing balance when balance is sufficient (gapAmount <= 0)", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockBillingInvoiceFindFirst.mockResolvedValueOnce({
      id: "inv-123",
      totalAmount: new Decimal(50000),
    })
    mockBillingAccountFindUnique.mockResolvedValueOnce({
      organizationId: "org-1",
      balance: new Decimal(100000),
    })
    mockPayWithBalance.mockResolvedValueOnce(undefined)

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.topupRequired).toBe(false)
    expect(json.message).toBe("Invoice paid with existing balance.")
    expect(mockPayWithBalance).toHaveBeenCalledWith("inv-123", "org-1")
  })

  it("creates topup invoice when shortfall exists (gapAmount > 0)", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockBillingInvoiceFindFirst.mockResolvedValueOnce({
      id: "inv-123",
      totalAmount: new Decimal(100000),
    })
    mockBillingAccountFindUnique.mockResolvedValueOnce({
      organizationId: "org-1",
      balance: new Decimal(40000),
    })
    mockCreateTopupInvoiceForGap.mockResolvedValueOnce({
      id: "topup-inv-1",
      invoiceNumber: "INV-TOPUP-001",
    })

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.topupRequired).toBe(true)
    expect(json.gapAmount).toBe(60000)
    expect(json.topupInvoiceId).toBe("topup-inv-1")
    expect(json.topupInvoiceNumber).toBe("INV-TOPUP-001")
    expect(json.totalDue).toBe(100000)
    expect(json.currentBalance).toBe(40000)
    expect(json.shortfall).toBe(60000)
    expect(mockCreateTopupInvoiceForGap).toHaveBeenCalledWith("org-1", 60000)
  })

  it("returns 500 when database throws", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockBillingInvoiceFindFirst.mockRejectedValueOnce(
      new Error("Database failure")
    )

    const res = await app().handle(
      new Request("http://localhost/invoice/topup-and-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-123" }),
      })
    )

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INTERNAL_SERVER_ERROR")
    expect(json.message).toBe("Database failure")
  })
})
