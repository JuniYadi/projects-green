import { describe, expect, it, mock, beforeEach } from "bun:test"

// Mock global fetch
const mockFetch = mock<(url: string, init?: RequestInit) => Promise<Response>>()
// @ts-expect-error - mock global fetch for test context
global.fetch = mockFetch

const {
  getAccount,
  getSubscriptions,
  getInvoices,
  getInvoice,
  topup,
  payWithBalance,
  topupAndPay,
  getPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
  getAdminMembers,
  getAdminMember,
  getAdminAdjustments,
} = await import("./billing-client")

describe("billing-client", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  function mockSuccessResponse(data: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    })
  }

  function mockErrorResponse(message: string, status: number, error = "ERROR") {
    return new Response(JSON.stringify({ ok: false, error, message }), {
      status,
      headers: { "content-type": "application/json" },
    })
  }

  function mockReject(error: Error) {
    mockFetch.mockRejectedValueOnce(error)
  }

  // ---------------------------------------------------------------
  // getAccount
  // ---------------------------------------------------------------
  describe("getAccount", () => {
    it("returns account data on success", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          tenantId: "tenant_1",
          balanceIdr: "100000",
          formattedBalance: "Rp 100.000",
          isAboveWarn: true,
          isPositive: true,
          accountAge: "30 days",
        })
      )

      const result = await getAccount()
      expect(result.ok).toBe(true)
      expect(result.balanceIdr).toBe("100000")
      expect(result.tenantId).toBe("tenant_1")
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/account")
    })

    it("throws on 500 error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Account not found", 500)
      )

      await expect(getAccount()).rejects.toThrow("Account not found")
    })

    it("throws on 401 error", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Unauthorized", 401))

      await expect(getAccount()).rejects.toThrow("Unauthorized")
    })

    it("throws when ok:false in 200 response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: "ERROR",
            message: "Session expired",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )

      await expect(getAccount()).rejects.toThrow("Session expired")
    })
  })

  // ---------------------------------------------------------------
  // getSubscriptions
  // ---------------------------------------------------------------
  describe("getSubscriptions", () => {
    it("returns subscriptions on success", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          subscriptions: [
            {
              id: "sub_1",
              packageCode: "PACKAGE_A",
              planCode: "PLAN_1",
              regionCode: "ID",
              billingMode: "prepaid",
              type: "monthly",
              status: "active",
              allocatedConfig: null,
              monthlyRateIdr: "100000",
              currentPeriodEnd: "2026-07-04",
            },
          ],
        })
      )

      const result = await getSubscriptions()
      expect(result.ok).toBe(true)
      expect(result.subscriptions).toHaveLength(1)
      expect(result.subscriptions[0].packageCode).toBe("PACKAGE_A")
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/subscriptions")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("No subscriptions found", 404)
      )

      await expect(getSubscriptions()).rejects.toThrow("No subscriptions found")
    })
  })

  // ---------------------------------------------------------------
  // getInvoices
  // ---------------------------------------------------------------
  describe("getInvoices", () => {
    it("returns invoices on success (no params)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ok: true, invoices: [] })
      )

      const result = await getInvoices()
      expect(result.ok).toBe(true)
      expect(result.invoices).toEqual([])
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/invoices")
    })

    it("appends URLSearchParams correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ok: true, invoices: [] })
      )

      const params = new URLSearchParams({
        status: "OPEN",
        page: "1",
        limit: "10",
      })
      await getInvoices(params)

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toBe("/api/billing/invoices?status=OPEN&page=1&limit=10")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Failed to fetch invoices", 500)
      )

      await expect(getInvoices()).rejects.toThrow("Failed to fetch invoices")
    })

    it("throws when ok:false in 200 response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: "INVOICE_ERROR",
            message: "No invoices available",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )

      await expect(getInvoices()).rejects.toThrow("No invoices available")
    })
  })

  // ---------------------------------------------------------------
  // getInvoice
  // ---------------------------------------------------------------
  describe("getInvoice", () => {
    it("returns invoice detail on success", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          invoice: {
            id: "inv_1",
            invoiceNumber: "INV-001",
            status: "OPEN",
            issuedAt: "2026-06-01",
            dueAt: "2026-06-30",
            totalAmountIdr: "500000",
            currency: "IDR",
            lines: [
              {
                description: "Service Fee",
                quantity: "1",
                unitPriceIdr: "500000",
                amountIdr: "500000",
              },
            ],
          },
        })
      )

      const result = await getInvoice("inv_1")
      expect(result.ok).toBe(true)
      expect(result.invoice.id).toBe("inv_1")
      expect(result.invoice.invoiceNumber).toBe("INV-001")
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/invoices/inv_1")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Invoice not found", 404)
      )

      await expect(getInvoice("inv_999")).rejects.toThrow("Invoice not found")
    })
  })

  // ---------------------------------------------------------------
  // topup
  // ---------------------------------------------------------------
  describe("topup", () => {
    it("returns topup success response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          adjustmentId: "adj_1",
          newBalanceIdr: "200000",
          amountIdr: "100000",
          type: "CREDIT",
        })
      )

      const result = await topup({
        amount: 100000,
        paymentMethod: "manual_bank_transfer",
      })
      expect(result.ok).toBe(true)
      expect(result.adjustmentId).toBe("adj_1")
      expect(result.newBalanceIdr).toBe("200000")
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/topup")
    })

    it("sends POST method with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          adjustmentId: "adj_2",
          newBalanceIdr: "150000",
          amountIdr: "50000",
          type: "CREDIT",
        })
      )

      const input = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer" as const,
      }
      await topup(input)

      const init = mockFetch.mock.calls[0][1] as RequestInit
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body as string)).toEqual(input)
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Topup failed", 400))

      await expect(
        topup({ amount: 1000, paymentMethod: "manual_bank_transfer" })
      ).rejects.toThrow("Topup failed")
    })
  })

  // ---------------------------------------------------------------
  // payWithBalance
  // ---------------------------------------------------------------
  describe("payWithBalance", () => {
    it("returns success response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ok: true, message: "Payment successful" })
      )

      const result = await payWithBalance("inv_1")
      expect(result.ok).toBe(true)
      expect(result.message).toBe("Payment successful")
      expect(mockFetch.mock.calls[0][0]).toBe(
        "/api/payments/invoice/pay-with-balance"
      )
    })

    it("sends POST method with invoiceId body", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ok: true, message: "OK" })
      )

      await payWithBalance("inv_42")

      const init = mockFetch.mock.calls[0][1] as RequestInit
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body as string)).toEqual({ invoiceId: "inv_42" })
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Payment failed", 402))

      await expect(payWithBalance("inv_1")).rejects.toThrow("Payment failed")
    })
  })

  // ---------------------------------------------------------------
  // topupAndPay
  // ---------------------------------------------------------------
  describe("topupAndPay", () => {
    it("returns success response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          message: "Topup and payment successful",
          topupRequired: false,
        })
      )

      const result = await topupAndPay("inv_1")
      expect(result.ok).toBe(true)
      expect(result.topupRequired).toBe(false)
      expect(mockFetch.mock.calls[0][0]).toBe(
        "/api/payments/invoice/topup-and-pay"
      )
    })

    it("sends POST method with invoiceId body", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          message: "OK",
          topupRequired: true,
          gapAmount: 50000,
        })
      )

      await topupAndPay("inv_99")

      const init = mockFetch.mock.calls[0][1] as RequestInit
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body as string)).toEqual({ invoiceId: "inv_99" })
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Topup and pay failed", 500)
      )

      await expect(topupAndPay("inv_1")).rejects.toThrow("Topup and pay failed")
    })
  })

  // ---------------------------------------------------------------
  // getPaymentMethods
  // ---------------------------------------------------------------
  describe("getPaymentMethods", () => {
    it("returns payment methods on success", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          accounts: [
            {
              id: "ba_1",
              bankCode: "BCA",
              bankName: "Bank BCA",
              accountName: "ACME Corp",
              accountNumber: "1234567890",
              isActive: true,
              isDefault: true,
            },
          ],
        })
      )

      const result = await getPaymentMethods()
      expect(result.ok).toBe(true)
      expect(result.accounts).toHaveLength(1)
      expect(result.accounts[0].bankCode).toBe("BCA")
      expect(mockFetch.mock.calls[0][0]).toBe("/api/payments/bank-accounts")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("No payment methods", 404)
      )

      await expect(getPaymentMethods()).rejects.toThrow("No payment methods")
    })
  })

  // ---------------------------------------------------------------
  // setDefaultPaymentMethod
  // ---------------------------------------------------------------
  describe("setDefaultPaymentMethod", () => {
    it("returns success on PATCH", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          account: {
            id: "ba_1",
            bankCode: "BCA",
            bankName: "Bank BCA",
            accountName: "ACME Corp",
            accountNumber: "1234567890",
            isActive: true,
            isDefault: true,
          },
        })
      )

      const result = await setDefaultPaymentMethod("ba_1")
      expect(result.ok).toBe(true)
      expect(result.account.id).toBe("ba_1")

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe("/api/payments/bank-accounts/ba_1/default")
      expect(init.method).toBe("PATCH")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Account not found", 404)
      )

      await expect(setDefaultPaymentMethod("ba_999")).rejects.toThrow(
        "Account not found"
      )
    })
  })

  // ---------------------------------------------------------------
  // removePaymentMethod
  // ---------------------------------------------------------------
  describe("removePaymentMethod", () => {
    it("returns success on DELETE", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ok: true, message: "Removed" })
      )

      const result = await removePaymentMethod("ba_1")
      expect(result.ok).toBe(true)
      expect(result.message).toBe("Removed")

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe("/api/payments/bank-accounts/ba_1")
      expect(init.method).toBe("DELETE")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Cannot remove default account", 400)
      )

      await expect(removePaymentMethod("ba_1")).rejects.toThrow(
        "Cannot remove default account"
      )
    })
  })

  // ---------------------------------------------------------------
  // getAdminMembers
  // ---------------------------------------------------------------
  describe("getAdminMembers", () => {
    it("returns admin members on success", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          members: [
            {
              userId: "user_1",
              name: "Alice",
              email: "alice@example.com",
              role: "admin",
              subscriptionCount: 5,
              activeSubscriptionCount: 3,
              monthlySpendIdr: "500000",
            },
          ],
        })
      )

      const result = await getAdminMembers()
      expect(result.ok).toBe(true)
      expect(result.members).toHaveLength(1)
      expect(result.members[0].name).toBe("Alice")
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/admin/members")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Forbidden", 403))

      await expect(getAdminMembers()).rejects.toThrow("Forbidden")
    })
  })

  // ---------------------------------------------------------------
  // getAdminMember
  // ---------------------------------------------------------------
  describe("getAdminMember", () => {
    it("returns admin member detail on success", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          userId: "user_1",
          name: "Alice",
          email: "alice@example.com",
          role: "admin",
          subscriptions: [],
          adjustments: [],
        })
      )

      const result = await getAdminMember("user_1")
      expect(result.userId).toBe("user_1")
      expect(result.name).toBe("Alice")
      expect(mockFetch.mock.calls[0][0]).toBe(
        "/api/billing/admin/members/user_1"
      )
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Member not found", 404)
      )

      await expect(getAdminMember("user_999")).rejects.toThrow(
        "Member not found"
      )
    })
  })

  // ---------------------------------------------------------------
  // getAdminAdjustments
  // ---------------------------------------------------------------
  describe("getAdminAdjustments", () => {
    it("returns adjustments on success (no params)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          adjustments: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        })
      )

      const result = await getAdminAdjustments()
      expect(result.ok).toBe(true)
      expect(result.adjustments).toEqual([])
      expect(mockFetch.mock.calls[0][0]).toBe("/api/billing/admin/adjustments")
    })

    it("builds query string from params", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          adjustments: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        })
      )

      await getAdminAdjustments({
        type: "CREDIT",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        page: 2,
        limit: 25,
      })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toBe(
        "/api/billing/admin/adjustments?type=CREDIT&startDate=2026-01-01&endDate=2026-06-30&page=2&limit=25"
      )
    })

    it("builds query string with partial params", async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          ok: true,
          adjustments: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        })
      )

      await getAdminAdjustments({ type: "DEBIT" })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toBe("/api/billing/admin/adjustments?type=DEBIT")
    })

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Adjustments query failed", 500)
      )

      await expect(getAdminAdjustments()).rejects.toThrow(
        "Adjustments query failed"
      )
    })
  })

  // ---------------------------------------------------------------
  // Network error
  // ---------------------------------------------------------------
  describe("network error handling", () => {
    it("throws Error when fetch rejects (network failure)", async () => {
      mockReject(new TypeError("Failed to fetch"))

      await expect(getAccount()).rejects.toThrow("Failed to fetch")
    })

    it("throws Error when fetch rejects for getSubscriptions", async () => {
      mockReject(new TypeError("Network error"))

      await expect(getSubscriptions()).rejects.toThrow("Network error")
    })
  })

  // ---------------------------------------------------------------
  // ok:false in a 200 OK response (comprehensive)
  // ---------------------------------------------------------------
  describe("ok:false in 200 response", () => {
    it("throws for topupAndPay with ok:false on 200", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: "BALANCE_ERROR",
            message: "Insufficient balance",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )

      await expect(topupAndPay("inv_1")).rejects.toThrow("Insufficient balance")
    })

    it("throws for setDefaultPaymentMethod with ok:false on 200", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: "NOT_ALLOWED",
            message: "Cannot set default",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )

      await expect(setDefaultPaymentMethod("ba_1")).rejects.toThrow(
        "Cannot set default"
      )
    })

    it("throws for removePaymentMethod with ok:false on 200", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: "ERROR",
            message: "Cannot remove",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )

      await expect(removePaymentMethod("ba_1")).rejects.toThrow("Cannot remove")
    })
  })
})
