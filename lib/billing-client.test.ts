import { afterEach, beforeEach, describe, expect, it, mock as bunMock } from "bun:test"

const originalFetch = globalThis.fetch

const mockFetch = (body: unknown, status = 200) => {
  globalThis.fetch = bunMock(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }) as unknown as typeof fetch
}

const mockFetchError = (status = 400, message = "Something went wrong") => {
  globalThis.fetch = bunMock(async () => {
    return new Response(
      JSON.stringify({ ok: false, error: "ERROR", message }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    )
  }) as unknown as typeof fetch
}

const getLastFetchUrl = () => {
  const calls = (globalThis.fetch as unknown as ReturnType<typeof bunMock>).mock
    .calls as Array<[RequestInfo | URL]>
  return String(calls[calls.length - 1]?.[0] ?? "")
}

describe("billing-client", () => {
  beforeEach(() => {
    globalThis.fetch = bunMock(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("getAccount", () => {
    it("fetches billing account", async () => {
      mockFetch({ ok: true, tenantId: "t_1", currency: "IDR", balanceIdr: "0" })
      const { getAccount } = await import("@/lib/billing-client")
      const result = await getAccount()
      expect(result.ok).toBe(true)
      expect(result.tenantId).toBe("t_1")
    })
  })

  describe("getSubscriptions", () => {
    it("fetches subscriptions", async () => {
      mockFetch({ ok: true, subscriptions: [] })
      const { getSubscriptions } = await import("@/lib/billing-client")
      const result = await getSubscriptions()
      expect(result.ok).toBe(true)
      expect(result.subscriptions).toEqual([])
    })
  })

  describe("getInvoices", () => {
    it("fetches invoices without params", async () => {
      mockFetch({ ok: true, invoices: [] })
      const { getInvoices } = await import("@/lib/billing-client")
      const result = await getInvoices()
      expect(result.ok).toBe(true)
    })

    it("fetches invoices with search params", async () => {
      mockFetch({ ok: true, invoices: [] })
      const { getInvoices } = await import("@/lib/billing-client")
      await getInvoices(new URLSearchParams({ status: "open" }))
      expect(getLastFetchUrl()).toContain("status=open")
    })
  })

  describe("getInvoice", () => {
    it("fetches single invoice by id", async () => {
      mockFetch({ ok: true, invoice: { id: "inv_1" } })
      const { getInvoice } = await import("@/lib/billing-client")
      const result = await getInvoice("inv_1")
      expect(result.invoice.id).toBe("inv_1")
    })
  })

  describe("topup", () => {
    it("sends POST to topup endpoint", async () => {
      mockFetch({
        ok: true,
        adjustmentId: "adj_1",
        newBalanceIdr: "500000",
        amountIdr: "500000",
        type: "CREDIT",
      })
      const { topup } = await import("@/lib/billing-client")
      const result = await topup({
        amount: 500000,
        paymentMethod: "manual_bank_transfer",
      })
      expect(result.type).toBe("CREDIT")
    })
  })

  describe("payWithBalance", () => {
    it("sends POST to pay endpoint", async () => {
      mockFetch({ ok: true, message: "Paid" })
      const { payWithBalance } = await import("@/lib/billing-client")
      const result = await payWithBalance("inv_1")
      expect(result.message).toBe("Paid")
    })
  })

  describe("topupAndPay", () => {
    it("sends POST to topup-and-pay", async () => {
      mockFetch({ ok: true, message: "Done", topupRequired: false })
      const { topupAndPay } = await import("@/lib/billing-client")
      const result = await topupAndPay("inv_1")
      expect(result.topupRequired).toBe(false)
    })
  })

  describe("getPaymentMethods", () => {
    it("fetches payment methods", async () => {
      mockFetch({ ok: true, accounts: [] })
      const { getPaymentMethods } = await import("@/lib/billing-client")
      const result = await getPaymentMethods()
      expect(result.ok).toBe(true)
    })
  })

  describe("setDefaultPaymentMethod", () => {
    it("sends PATCH", async () => {
      mockFetch({ ok: true, account: { id: "pm_1" } })
      const { setDefaultPaymentMethod } = await import("@/lib/billing-client")
      const result = await setDefaultPaymentMethod("pm_1")
      expect(result.ok).toBe(true)
    })
  })

  describe("removePaymentMethod", () => {
    it("sends DELETE", async () => {
      mockFetch({ ok: true, message: "Removed" })
      const { removePaymentMethod } = await import("@/lib/billing-client")
      const result = await removePaymentMethod("pm_1")
      expect(result.message).toBe("Removed")
    })
  })

  describe("admin functions", () => {
    it("getAdminMembers", async () => {
      mockFetch({ ok: true, members: [] })
      const { getAdminMembers } = await import("@/lib/billing-client")
      const result = await getAdminMembers()
      expect(result.ok).toBe(true)
    })

    it("getAdminMember", async () => {
      mockFetch({ userId: "u_1", subscriptions: [], adjustments: [] })
      const { getAdminMember } = await import("@/lib/billing-client")
      const result = await getAdminMember("u_1")
      expect(result.userId).toBe("u_1")
    })

    it("getAdminAdjustments", async () => {
      mockFetch({
        ok: true,
        adjustments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      const { getAdminAdjustments } = await import("@/lib/billing-client")
      const result = await getAdminAdjustments()
      expect(result.ok).toBe(true)
    })

    it("getAdminAdjustments with filters", async () => {
      mockFetch({
        ok: true,
        adjustments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      const { getAdminAdjustments } = await import("@/lib/billing-client")
      await getAdminAdjustments({ type: "CREDIT", page: 2, limit: 10 })
      expect(getLastFetchUrl()).toContain("type=CREDIT")
      expect(getLastFetchUrl()).toContain("page=2")
    })

    it("getAdminInvoices", async () => {
      mockFetch({
        ok: true,
        invoices: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      const { getAdminInvoices } = await import("@/lib/billing-client")
      const result = await getAdminInvoices()
      expect(result.ok).toBe(true)
    })

    it("getAdminSubscriptions", async () => {
      mockFetch({
        ok: true,
        subscriptions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      const { getAdminSubscriptions } = await import("@/lib/billing-client")
      const result = await getAdminSubscriptions()
      expect(result.ok).toBe(true)
    })

    it("getAdminStats", async () => {
      mockFetch({
        ok: true,
        totalBalance: "0",
        activeOrgs: 0,
        totalSpend: "0",
        lowBalanceOrgs: 0,
      })
      const { getAdminStats } = await import("@/lib/billing-client")
      const result = await getAdminStats()
      expect(result.ok).toBe(true)
    })

    it("getAdminOrgs", async () => {
      mockFetch({
        ok: true,
        orgs: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      const { getAdminOrgs } = await import("@/lib/billing-client")
      const result = await getAdminOrgs()
      expect(result.ok).toBe(true)
    })

    it("getAdminOrgDetail", async () => {
      mockFetch({
        ok: true,
        org: { orgId: "org_1", subscriptions: [], contacts: 0, recentInvoices: [] },
      })
      const { getAdminOrgDetail } = await import("@/lib/billing-client")
      const result = await getAdminOrgDetail("org_1")
      expect(result.ok).toBe(true)
    })

    it("adminTopup", async () => {
      mockFetch({
        ok: true,
        adjustmentId: "adj_1",
        newBalanceIdr: "100000",
        amountIdr: "100000",
        type: "CREDIT",
      })
      const { adminTopup } = await import("@/lib/billing-client")
      const result = await adminTopup({ orgId: "org_1", amount: 100000 })
      expect(result.type).toBe("CREDIT")
    })

    it("getAdminUsage", async () => {
      mockFetch({ ok: true, data: { breakdown: [], trend: [] } })
      const { getAdminUsage } = await import("@/lib/billing-client")
      const result = await getAdminUsage()
      expect(result.ok).toBe(true)
    })
  })

  describe("billing contacts", () => {
    it("getBillingAccount", async () => {
      mockFetch({
        ok: true,
        id: "ba_1",
        organizationId: "org_1",
        contacts: [],
        alertPreferences: {},
      })
      const { getBillingAccount } = await import("@/lib/billing-client")
      const result = await getBillingAccount()
      expect(result.ok).toBe(true)
    })

    it("addBillingContact", async () => {
      mockFetch({ ok: true, id: "c_1" })
      const { addBillingContact } = await import("@/lib/billing-client")
      const result = await addBillingContact({ email: "test@example.com" })
      expect(result.ok).toBe(true)
    })

    it("updateBillingContact", async () => {
      mockFetch({ ok: true, id: "c_1" })
      const { updateBillingContact } = await import("@/lib/billing-client")
      const result = await updateBillingContact("c_1", { name: "Updated" })
      expect(result.ok).toBe(true)
    })

    it("deactivateBillingContact", async () => {
      mockFetch({ ok: true })
      const { deactivateBillingContact } = await import("@/lib/billing-client")
      const result = await deactivateBillingContact("c_1")
      expect(result.ok).toBe(true)
    })

    it("updateBillingCurrency", async () => {
      mockFetch({ ok: true, preferredCurrency: "USD" })
      const { updateBillingCurrency } = await import("@/lib/billing-client")
      const result = await updateBillingCurrency("USD")
      expect(result.preferredCurrency).toBe("USD")
    })

    it("updateBillingAlerts", async () => {
      mockFetch({
        ok: true,
        id: "ba_1",
        organizationId: "org_1",
        contacts: [],
        alertPreferences: {},
      })
      const { updateBillingAlerts } = await import("@/lib/billing-client")
      const result = await updateBillingAlerts({
        balanceThresholdEnabled: true,
        balanceThresholdAmount: 50000,
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("error handling", () => {
    it("throws on non-ok response", async () => {
      mockFetchError(400, "Bad request")
      const { getAccount } = await import("@/lib/billing-client")
      await expect(getAccount()).rejects.toThrow("Bad request")
    })
  })
})
