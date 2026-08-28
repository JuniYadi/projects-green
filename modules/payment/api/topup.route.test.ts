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

const mockBillingAccountFindUnique = mock()
const mockBillingInvoiceUpdate = mock()
const mockPrismaTransaction = mock(async (actions: unknown[]) => actions)

const mockPrisma = {
  billingAccount: {
    findUnique: mockBillingAccountFindUnique,
  },
  billingInvoice: {
    update: mockBillingInvoiceUpdate,
  },
  $transaction: mockPrismaTransaction,
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// ── Mock Services & Providers ───────────────────────────

const mockCreateTopupInvoice = mock()
const mockGetInvoiceForUser = mock()
const mockGetInvoicesForOrganization = mock()

mock.module("../services/payment.service", () => ({
  PaymentService: class {
    createTopupInvoice = mockCreateTopupInvoice
    getInvoiceForUser = mockGetInvoiceForUser
    getInvoicesForOrganization = mockGetInvoicesForOrganization
  },
}))

const mockGetActiveAccounts = mock()

mock.module("../services/bank-account.service", () => ({
  BankAccountService: class {
    getActiveAccounts = mockGetActiveAccounts
  },
}))

const mockDuitkuCreatePayment = mock()

mock.module("../services/duitku.service", () => ({
  DuitkuService: class {
    createPayment = mockDuitkuCreatePayment
  },
}))

const mockFindByTypeForCurrency = mock()
const mockGetDecryptedConfig = mock()

mock.module("../services/gateway.service", () => ({
  GatewayService: class {
    findByTypeForCurrency = mockFindByTypeForCurrency
    getDecryptedConfig = mockGetDecryptedConfig
  },
}))

const mockCurrencyFindByCode = mock()
const mockCurrencyGetBase = mock()

mock.module("@/modules/billing/currency.service", () => ({
  CurrencyService: class {
    findByCode = mockCurrencyFindByCode
    getBase = mockCurrencyGetBase
  },
}))

const mockPaypalCreatePayment = mock()

mock.module("../providers/paypal.provider", () => ({
  paypalProvider: {
    createPayment: mockPaypalCreatePayment,
  },
}))

// ── Import route after mocks ────────────────────────────

const { createTopupRoutes, createPaymentHistoryRoutes } =
  await import("./topup.route")

function app() {
  return new Elysia()
    .use(createTopupRoutes())
    .use(createPaymentHistoryRoutes())
    .compile()
}

describe("TopupRoute POST /topup", () => {
  beforeEach(() => {
    mockAuthValue = {
      user: { id: "user_1", email: "user@example.com" },
      organizationId: "org_1",
    }
    mockBillingAccountFindUnique.mockReset()
    mockBillingInvoiceUpdate.mockReset()
    mockCreateTopupInvoice.mockReset()
    mockGetActiveAccounts.mockReset()
    mockDuitkuCreatePayment.mockReset()
    mockFindByTypeForCurrency.mockReset()
    mockGetDecryptedConfig.mockReset()
    mockPaypalCreatePayment.mockReset()
  })

  it("returns 401 when organizationId is missing", async () => {
    mockAuthValue = { user: { id: "user_1", email: "user@example.com" } }

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "MANUAL_BANK" }),
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 400 when body fails schema validation", async () => {
    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: -10, paymentMethod: "MANUAL_BANK" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("VALIDATION_ERROR")
  })

  it("returns 400 when MANUAL_BANK has no active accounts", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockGetActiveAccounts.mockResolvedValueOnce([])

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "MANUAL_BANK" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("MANUAL_BANK_NOT_AVAILABLE")
  })

  it("creates manual bank invoice successfully", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockGetActiveAccounts.mockResolvedValueOnce([
      { id: "acc_1", bankName: "BCA" },
    ])
    mockCreateTopupInvoice.mockResolvedValueOnce({
      id: "inv_1",
      invoiceNumber: "INV-001",
      totalAmount: new Decimal(50000),
      status: "UNPAID",
      paymentMethod: "MANUAL_BANK",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      type: "TOPUP",
    })

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "MANUAL_BANK" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.invoice.id).toBe("inv_1")
    expect(json.invoice.paymentMethod).toBe("MANUAL_BANK")
  })

  it("returns 400 when VA/QRIS gateway is not available", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockFindByTypeForCurrency.mockResolvedValueOnce(null)

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "VA" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("GATEWAY_NOT_AVAILABLE")
  })

  it("handles VA topup with Duitku payment gateway", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockFindByTypeForCurrency.mockResolvedValueOnce({ id: "gw_duitku" })
    mockCreateTopupInvoice.mockResolvedValueOnce({
      id: "inv_va_1",
      invoiceNumber: "INV-VA-001",
      totalAmount: new Decimal(50000),
      status: "UNPAID",
      paymentMethod: "VA",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      type: "TOPUP",
    })
    mockDuitkuCreatePayment.mockResolvedValueOnce({
      paymentUrl: "https://duitku.com/pay",
      vaNumber: "88880001",
      reference: "duitku_ref_1",
    })

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "VA" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.vaNumber).toBe("88880001")
    expect(json.paymentUrl).toBe("https://duitku.com/pay")
    expect(mockDuitkuCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: "VC" })
    )
  })

  it("handles QRIS topup with Duitku payment gateway", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockFindByTypeForCurrency.mockResolvedValueOnce({ id: "gw_duitku" })
    mockCreateTopupInvoice.mockResolvedValueOnce({
      id: "inv_qris_1",
      invoiceNumber: "INV-QRIS-001",
      totalAmount: new Decimal(50000),
      status: "UNPAID",
      paymentMethod: "QRIS",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      type: "TOPUP",
    })
    mockDuitkuCreatePayment.mockResolvedValueOnce({
      paymentUrl: "https://duitku.com/qris",
      vaNumber: null,
      reference: "duitku_ref_qr",
    })

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "QRIS" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockDuitkuCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: "QR" })
    )
  })

  it("returns 400 when PAYPAL gateway is not available", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockFindByTypeForCurrency.mockResolvedValue(null)

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50, paymentMethod: "PAYPAL" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("PAYPAL_NOT_AVAILABLE")
  })

  it("handles PAYPAL topup successfully", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockFindByTypeForCurrency.mockResolvedValueOnce({ id: "gw_paypal" })
    mockCreateTopupInvoice.mockResolvedValueOnce({
      id: "inv_pp_1",
      invoiceNumber: "INV-PP-001",
      totalAmount: new Decimal(50),
      status: "UNPAID",
      paymentMethod: "PAYPAL",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      type: "TOPUP",
    })
    mockGetDecryptedConfig.mockResolvedValueOnce({
      clientId: "pp_client",
      secret: "pp_sec",
    })
    mockPaypalCreatePayment.mockResolvedValueOnce({
      redirectUrl: "https://paypal.com/checkout",
      reference: "pp_ref_1",
    })

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50, paymentMethod: "PAYPAL" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.paymentUrl).toBe("https://paypal.com/checkout")
  })

  it("returns 400 / 500 when service throws an error", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockGetActiveAccounts.mockRejectedValueOnce(
      new Error("PayPal gateway not found")
    )

    const res = await app().handle(
      new Request("http://localhost/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, paymentMethod: "MANUAL_BANK" }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("CLIENT_ERROR")
  })
})

describe("TopupRoute GET /topup/invoice/:id", () => {
  beforeEach(() => {
    mockAuthValue = {
      user: { id: "user_1", email: "user@example.com" },
      organizationId: "org_1",
    }
    mockGetInvoiceForUser.mockReset()
  })

  it("returns 401 if unauthenticated", async () => {
    mockAuthValue = { user: null }

    const res = await app().handle(
      new Request("http://localhost/topup/invoice/inv_1")
    )

    expect(res.status).toBe(401)
  })

  it("returns NOT_FOUND if invoice not found", async () => {
    mockGetInvoiceForUser.mockResolvedValueOnce(null)

    const res = await app().handle(
      new Request("http://localhost/topup/invoice/inv_1")
    )

    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  it("returns invoice when found", async () => {
    mockGetInvoiceForUser.mockResolvedValueOnce({
      id: "inv_1",
      invoiceNumber: "INV-001",
    })

    const res = await app().handle(
      new Request("http://localhost/topup/invoice/inv_1")
    )

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.invoice.id).toBe("inv_1")
  })
})

describe("TopupRoute GET /topup/bank-accounts", () => {
  beforeEach(() => {
    mockAuthValue = {
      user: { id: "user_1", email: "user@example.com" },
      organizationId: "org_1",
    }
    mockBillingAccountFindUnique.mockReset()
    mockGetActiveAccounts.mockReset()
  })

  it("returns active bank accounts for user currency", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockGetActiveAccounts.mockResolvedValueOnce([
      { id: "acc_usd_1", bankName: "Chase" },
    ])

    const res = await app().handle(
      new Request("http://localhost/topup/bank-accounts")
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.currency).toBe("USD")
    expect(json.data).toHaveLength(1)
  })
})

describe("TopupRoute GET /topup/methods", () => {
  beforeEach(() => {
    mockAuthValue = {
      user: { id: "user_1", email: "user@example.com" },
      organizationId: "org_1",
    }
    mockBillingAccountFindUnique.mockReset()
    mockGetActiveAccounts.mockReset()
    mockFindByTypeForCurrency.mockReset()
    mockCurrencyFindByCode.mockReset()
    mockCurrencyGetBase.mockReset()
  })

  it("returns available methods and config presets", async () => {
    mockBillingAccountFindUnique.mockResolvedValueOnce({ currency: "IDR" })
    mockGetActiveAccounts.mockResolvedValueOnce([{ id: "bca_1" }])
    mockFindByTypeForCurrency
      .mockResolvedValueOnce({ id: "duitku_gw" }) // GATEWAY
      .mockResolvedValueOnce(null) // paypal
      .mockResolvedValueOnce(null) // PAYPAL
    mockCurrencyFindByCode.mockResolvedValueOnce({
      ratePerBase: new Decimal(16000),
      symbol: "Rp",
      minTopup: new Decimal(10000),
      maxTopup: new Decimal(10000000),
    })
    mockCurrencyGetBase.mockResolvedValueOnce({ code: "USD" })

    const res = await app().handle(
      new Request("http://localhost/topup/methods")
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.currency).toBe("IDR")
    expect(json.methods.MANUAL_BANK).toBe(true)
    expect(json.methods.VA).toBe(true)
    expect(json.methods.QRIS).toBe(true)
    expect(json.methods.PAYPAL).toBe(false)
    expect(json.config.presets).toBeDefined()
  })
})

describe("PaymentHistoryRoute GET /history", () => {
  beforeEach(() => {
    mockAuthValue = {
      user: { id: "user_1", email: "user@example.com" },
      organizationId: "org_1",
    }
    mockGetInvoicesForOrganization.mockReset()
  })

  it("returns 401 when organizationId is missing", async () => {
    mockAuthValue = { user: null }

    const res = await app().handle(new Request("http://localhost/history"))

    expect(res.status).toBe(401)
  })

  it("returns invoices for organization", async () => {
    mockGetInvoicesForOrganization.mockResolvedValueOnce([
      { id: "inv_1", invoiceNumber: "INV-001" },
    ])

    const res = await app().handle(new Request("http://localhost/history"))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(1)
  })
})
