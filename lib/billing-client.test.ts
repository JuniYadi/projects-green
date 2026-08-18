import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockFetch = mock()
const mockGetApiBaseUrl = mock(() => "https://billing.test")
// @ts-expect-error — mock replaces global fetch for testing
globalThis.fetch = mockFetch

mock.module("@/lib/eden", () => ({ getApiBaseUrl: mockGetApiBaseUrl }))

import {
  addBillingContact,
  adminTopup,
  billingPeriodLabel,
  cancelSubscription,
  changePlan,
  createAdminPricing,
  createAdminPromotion,
  createVoucher,
  deactivateAdminPricing,
  deactivateBillingContact,
  disableAdminPromotion,
  disableVoucher,
  getAccount,
  getAdminAdjustments,
  getAdminBillingContacts,
  getAdminInvoices,
  getAdminMember,
  getAdminMembers,
  getAdminOrgDetail,
  getAdminOrgs,
  getAdminOrders,
  getAdminPricing,
  getAdminCatalogProductsList,
  getAdminCatalogProductDetail,
  deleteAdminCatalogProduct,
  upsertAdminCatalogPackage,
  upsertAdminCatalogProduct,
  getAdminPromotion,
  getAdminPromotionClaims,
  getAdminPromotions,
  getAdminStats,
  getAdminSubscriptions,
  getAdminUsage,
  getBillingAccount,
  getCatalog,
  getCatalogProduct,
  getInvoice,
  getInvoices,
  getPaymentMethodCurrencies,
  getPaymentMethods,
  getSubscriptions,
  getVoucherClaims,
  getVoucherDetail,
  getVouchers,
  getAdminAuditLogs,
  updateVoucher,
  payWithBalance,
  previewChangePlan,
  publishAdminPromotion,
  reinstateSubscription,
  refreshAdminOrgMetadata,
  removePaymentMethod,
  setDefaultPaymentMethod,
  topup,
  topupAndPay,
  updateAdminPricing,
  updateAdminPromotion,
  updateBillingAlerts,
  updateBillingContact,
  updateBillingCurrency,
  voucherCurrencyPolicyLabel,
  voucherDiscountPreview,
  voucherDiscountTypeLabel,
  voucherKindLabel,
  voucherStatusLabel,
} from "./billing-client"

const jsonResponse = (body: unknown, status = 200, ok = true) =>
  ({ ok, status, json: async () => body }) as Response

const calledRequest = () => {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
  return { url: new URL(url), init }
}

describe("getAdminAuditLogs", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetApiBaseUrl.mockClear()
    mockGetApiBaseUrl.mockReturnValue("https://billing.test")
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
  })

  it("calls the correct endpoint with default params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, logs: [], total: 0 }),
    } as Response)

    const result = await getAdminAuditLogs()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("/api/billing/admin/billing-audit/logs")
    expect(result.ok).toBe(true)
  })

  it("passes query params correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, logs: [], total: 0 }),
    } as Response)

    await getAdminAuditLogs({
      page: 2,
      limit: 10,
      entityType: "ServiceSubscription",
      entityId: "sub-123",
      billingAccountId: "ba-456",
    })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("page=2")
    expect(url).toContain("limit=10")
    expect(url).toContain("entityType=ServiceSubscription")
    expect(url).toContain("entityId=sub-123")
    expect(url).toContain("billingAccountId=ba-456")
  })

  it("omits undefined params from the URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, logs: [], total: 0 }),
    } as Response)

    await getAdminAuditLogs({ limit: 5 })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("limit=5")
    expect(url).not.toContain("page")
    expect(url).not.toContain("entityType")
    expect(url).not.toContain("entityId")
    expect(url).not.toContain("billingAccountId")
  })

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, message: "Internal error" }),
    } as Response)

    await expect(getAdminAuditLogs()).rejects.toThrow()
  })

  it("throws when response ok is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, message: "Forbidden" }),
    } as Response)

    await expect(getAdminAuditLogs()).rejects.toThrow()
  })
})

describe("admin billing fetch helpers", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetApiBaseUrl.mockClear()
    mockGetApiBaseUrl.mockReturnValue("https://billing.test")
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
  })

  it("builds member list and detail URLs", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, members: [] }))
    await getAdminMembers({ orgId: "org-1" })

    const request = calledRequest()
    expect(request.url.origin).toBe("https://billing.test")
    expect(request.url.pathname).toBe("/api/billing/admin/members")
    expect(request.url.searchParams.get("orgId")).toBe("org-1")

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, members: [] }))
    await getAdminMembers()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/members"
    )

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, userId: "user-1" })
    )
    await getAdminMember("user-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/members/user-1"
    )
  })

  it("includes all adjustment filters, including zero values", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await getAdminAdjustments({
      type: "CREDIT",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      page: 0,
      limit: 0,
      orgId: "org-1",
    })

    const { url } = calledRequest()
    expect(url.pathname).toBe("/api/billing/admin/adjustments")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: "CREDIT",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      page: "0",
      limit: "0",
      orgId: "org-1",
    })
  })

  it("uses the bare adjustments URL when no filters are supplied", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminAdjustments()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/adjustments"
    )
  })

  it("builds invoice and subscription list query strings", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminInvoices({
      page: 2,
      limit: 25,
      status: "OPEN",
      organizationId: "org-1",
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      page: "2",
      limit: "25",
      status: "OPEN",
      organizationId: "org-1",
    })
    expect(calledRequest().url.pathname).toBe("/api/billing/admin/invoices")

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminInvoices()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/invoices"
    )

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminSubscriptions({
      page: 3,
      limit: 10,
      status: "ACTIVE",
      orgId: "org-2",
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      page: "3",
      limit: "10",
      status: "ACTIVE",
      orgId: "org-2",
    })
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/subscriptions"
    )

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminSubscriptions()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/subscriptions"
    )
  })

  it("fetches admin stats and organization details", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, activeOrgs: 2 }))
    await getAdminStats()
    expect(calledRequest().url.pathname).toBe("/api/billing/admin/stats")

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, org: {} }))
    await getAdminOrgDetail("org-1")
    expect(calledRequest().url.pathname).toBe("/api/billing/admin/orgs/org-1")
  })

  it("builds organization list filters and metadata refresh body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminOrgs({
      page: 2,
      limit: 20,
      search: "Acme Inc",
      currency: "USD",
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      page: "2",
      limit: "20",
      search: "Acme Inc",
      currency: "USD",
    })

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminOrgs()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/orgs"
    )

    const orgIds = { orgIds: ["org-1", "org-2"] }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, refreshed: 2 }))
    await refreshAdminOrgMetadata(orgIds)
    const request = calledRequest()
    expect(request.url.pathname).toBe(
      "/api/billing/admin/orgs/metadata/refresh"
    )
    expect(request.init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(orgIds),
    })
  })

  it("posts admin topups with the supplied input", async () => {
    const input = { orgId: "org-1", amount: 1500, reason: "credit" }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await adminTopup(input)

    const request = calledRequest()
    expect(request.url.href).toBe(
      "https://billing.test/api/billing/admin/topup"
    )
    expect(request.init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(input),
    })
  })

  it("builds usage filters and omits an empty query", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminUsage({ days: 30, orgId: "org-1" })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      days: "30",
      orgId: "org-1",
    })

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await getAdminUsage()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/usage"
    )
  })

  it("fetches billing contacts and sends contact mutations", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, contacts: [] }))
    await getAdminBillingContacts("org-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/orgs/org-1/contacts"
    )

    const contact = { email: "billing@example.com", name: "Billing" }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await addBillingContact(contact)
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(contact),
    })

    const update = { name: "Accounts Payable", notifyOnInvoice: true }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await updateBillingContact("contact-1", update)
    expect(calledRequest().url.pathname).toBe("/api/billing/contacts/contact-1")
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
      body: JSON.stringify(update),
    })

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deactivateBillingContact("contact-1")
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    })
  })

  it("updates billing currency and alert preferences", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await updateBillingCurrency("USD")
    expect(calledRequest().url.pathname).toBe("/api/billing/currency")
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
      body: JSON.stringify({ preferredCurrency: "USD" }),
    })

    const alerts = {
      balanceThresholdEnabled: true,
      balanceThresholdAmount: 100,
    }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await updateBillingAlerts(alerts)
    expect(calledRequest().url.pathname).toBe("/api/billing/alerts")
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
      body: JSON.stringify(alerts),
    })
  })

  it("builds pricing filters, including false includeInactive", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, data: [] }))
    await getAdminPricing({
      packageCode: "PRO",
      planCode: "PRO-MONTHLY",
      regionCode: "US",
      billingPeriod: "MONTHLY",
      currency: "USD",
      includeInactive: false,
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      packageCode: "PRO",
      planCode: "PRO-MONTHLY",
      regionCode: "US",
      billingPeriod: "MONTHLY",
      currency: "USD",
      includeInactive: "false",
    })

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, data: [] }))
    await getAdminPricing()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/pricing"
    )
  })

  it("sends create, update, and deactivate pricing requests", async () => {
    const input = {
      planId: "plan-1",
      regionId: "region-1",
      billingPeriod: "MONTHLY" as const,
      chargeUnit: "SUBSCRIPTION" as const,
      periodPrice: "1200",
      currency: "USD",
      effectiveFrom: "2026-01-01",
    }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, data: {} }))
    await createAdminPricing(input)
    expect(calledRequest().url.pathname).toBe("/api/billing/admin/pricing")
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(input),
    })

    const update = { periodPrice: 1500, isActive: false }
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, data: {} }))
    await updateAdminPricing("pricing-1", update)
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/pricing/pricing-1"
    )
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
      body: JSON.stringify(update),
    })

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, data: {} }))
    await deactivateAdminPricing("pricing-1")
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    })
  })

  it("builds order filters and omits empty values", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, orders: [] }))
    await getAdminOrders({
      page: 1,
      limit: 50,
      organizationId: "org-1",
      packageCode: "PRO",
      status: "PAID",
      billingPeriod: "MONTHLY",
      from: "2026-01-01",
      to: "2026-01-31",
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      page: "1",
      limit: "50",
      organizationId: "org-1",
      packageCode: "PRO",
      status: "PAID",
      billingPeriod: "MONTHLY",
      from: "2026-01-01",
      to: "2026-01-31",
    })

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, orders: [] }))
    await getAdminOrders({ organizationId: "", status: undefined })
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/orders"
    )
  })

  it("uses API error messages and status fallback errors", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: "Billing access denied" })
    )
    await expect(getAdminStats()).rejects.toThrow("Billing access denied")

    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }, 503, false))
    await expect(getAdminStats()).rejects.toThrow("Billing API error: 503")
  })

  it("sends catalog product and package administration requests", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, products: [] }))
    await getAdminCatalogProductsList("VPN")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/VPN/products"
    )

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, product: { code: "BASIC" } })
    )
    await getAdminCatalogProductDetail("VPN", "BASIC")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/VPN/products/BASIC"
    )

    const productInput = {
      name: "Basic Plan",
      prices: [
        {
          billingPeriod: "MONTHLY",
          currency: "IDR",
          periodPrice: 50000,
        },
      ],
    }
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, data: { code: "BASIC" } })
    )
    await upsertAdminCatalogProduct("VPN", "BASIC", productInput)
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/VPN/products/BASIC"
    )
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(productInput),
    })

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, message: "Deleted" })
    )
    await deleteAdminCatalogProduct("VPN", "BASIC")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/VPN/products/BASIC"
    )
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    })

    const pkgInput = {
      code: "WHATSAPP",
      name: "WhatsApp Service",
      description: "WhatsApp hosting",
      isActive: true,
    }
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, data: { code: "WHATSAPP" } })
    )
    await upsertAdminCatalogPackage(pkgInput)
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/products"
    )
    expect(calledRequest().init).toEqual({
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(pkgInput),
    })
  })
})

describe("customer billing and payment helpers", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetApiBaseUrl.mockClear()
    mockGetApiBaseUrl.mockReturnValue("https://billing.test")
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
  })

  it("fetches account, subscriptions, invoices, and invoice details", async () => {
    await getAccount({ headers: { "X-Trace": "trace-1" } })
    expect(calledRequest().url.pathname).toBe("/api/billing/account")
    expect(calledRequest().init).toEqual({
      headers: { "X-Trace": "trace-1" },
    })

    await getBillingAccount()
    expect(calledRequest().url.pathname).toBe("/api/billing/account/detail")
    await getSubscriptions()
    expect(calledRequest().url.pathname).toBe("/api/billing/subscriptions")

    const params = new URLSearchParams({
      status: "OPEN",
      search: "Acme & Sons",
    })
    await getInvoices(params)
    expect(calledRequest().url.pathname).toBe("/api/billing/invoices")
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      status: "OPEN",
      search: "Acme & Sons",
    })
    await getInvoices()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/invoices"
    )

    await getInvoice("invoice/1")
    expect(calledRequest().url.pathname).toBe("/api/billing/invoices/invoice/1")
  })

  it("posts topups, invoice payments, and payment method mutations", async () => {
    const input = {
      amount: 1250,
      paymentMethod: "manual_bank_transfer" as const,
    }
    await topup(input)
    expect(calledRequest().url.pathname).toBe("/api/billing/topup")
    expect(calledRequest().init).toMatchObject({
      method: "POST",
      body: JSON.stringify(input),
    })

    await payWithBalance("invoice-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/payments/invoice/pay-with-balance"
    )
    expect(calledRequest().init?.body).toBe(
      JSON.stringify({ invoiceId: "invoice-1" })
    )

    await topupAndPay("invoice-2")
    expect(calledRequest().url.pathname).toBe(
      "/api/payments/invoice/topup-and-pay"
    )

    await getPaymentMethods()
    expect(calledRequest().url.pathname).toBe("/api/payments/bank-accounts")
    await setDefaultPaymentMethod("payment-1")
    expect(calledRequest().init?.method).toBe("PATCH")
    expect(calledRequest().url.pathname).toBe(
      "/api/payments/bank-accounts/payment-1/default"
    )
    await removePaymentMethod("payment-1")
    expect(calledRequest().init?.method).toBe("DELETE")
    expect(calledRequest().url.pathname).toBe(
      "/api/payments/bank-accounts/payment-1"
    )
  })
  it("returns supported currencies and handles missing currency lists", () => {
    const method = { supportedCurrencies: ["USD", "IDR"] } as Parameters<
      typeof getPaymentMethodCurrencies
    >[0]
    expect(getPaymentMethodCurrencies(method)).toEqual(["USD", "IDR"])
    expect(
      getPaymentMethodCurrencies(
        {} as Parameters<typeof getPaymentMethodCurrencies>[0]
      )
    ).toEqual([])
  })

  it("propagates API messages and status errors", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: "No access" })
    )
    await expect(getAccount()).rejects.toThrow("No access")
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }, 502, false))
    await expect(getSubscriptions()).rejects.toThrow("Billing API error: 502")
  })

  it("fetches catalog endpoints with optional currency", async () => {
    await getCatalog("IDR")
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/catalog?currency=IDR"
    )
    await getCatalogProduct("pro plan", "USD")
    expect(calledRequest().url.pathname).toBe("/api/billing/catalog/pro%20plan")
    expect(calledRequest().url.searchParams.get("currency")).toBe("USD")
    await getCatalog()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/catalog"
    )
  })
})

describe("voucher and promotion helpers", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetApiBaseUrl.mockClear()
    mockGetApiBaseUrl.mockReturnValue("https://billing.test")
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, data: [] }))
  })

  it("renders voucher labels and discount previews", () => {
    expect(voucherKindLabel("BALANCE_CREDIT")).toBe("Balance Credit")
    expect(voucherKindLabel("PRODUCT_PROMOTION")).toBe("Product Promotion")
    expect(voucherDiscountTypeLabel("PERCENTAGE")).toBe("Percentage")
    expect(voucherDiscountTypeLabel("FIXED")).toBe("Fixed Amount")
    expect(voucherCurrencyPolicyLabel("MATCH_CURRENCY_ONLY")).toBe(
      "Match currency only"
    )
    expect(voucherCurrencyPolicyLabel("CONVERT_AT_CHECKOUT")).toBe(
      "Convert at checkout"
    )
    expect(voucherCurrencyPolicyLabel("CONVERT_AT_REDEMPTION")).toBe(
      "Convert at redemption"
    )
    expect(voucherStatusLabel("ACTIVE")).toBe("ACTIVE")

    const base = {
      id: "v-1",
      code: "SAVE",
      prefix: null,
      status: "ACTIVE" as const,
      kind: "PRODUCT_PROMOTION" as const,
      discountType: "PERCENTAGE" as const,
      discountValue: "15",
      discountCurrency: null,
      currencyPolicy: "MATCH_CURRENCY_ONLY" as const,
      firstCheckoutOnly: false,
      allowUpgrade: false,
      stackable: false,
      minimumOrderAmount: null,
      maximumDiscountAmount: null,
      maxClaims: 10,
      claimedCount: 0,
      expiresAt: "2026-12-31",
      amount: "1000",
      currency: "USD",
      targetWorkosUserId: null,
      targetOrganizationId: null,
      allowedPackageCodes: null,
      allowedPlanCodes: null,
      allowedBillingPeriods: null,
      metadataJson: null,
      createdByWorkosUserId: "u-1",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }
    expect(voucherDiscountPreview(base)).toBe("15% off")
    expect(
      voucherDiscountPreview({
        ...base,
        discountType: "FIXED",
        discountValue: "25",
        discountCurrency: "EUR",
      })
    ).toBe("EUR 25,00")
    expect(
      voucherDiscountPreview({
        ...base,
        kind: "BALANCE_CREDIT",
        amount: "10.5",
        currency: "USD",
      })
    ).toBe("USD 10.50 credit")
    expect(
      voucherDiscountPreview({
        ...base,
        discountType: null,
        discountValue: null,
      })
    ).toBe("No discount configured")
  })

  it("builds voucher list queries and CRUD requests", async () => {
    await getVouchers({
      status: "ACTIVE",
      prefix: "SPRING SALE",
      limit: 10,
      offset: 0,
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      status: "ACTIVE",
      prefix: "SPRING SALE",
      limit: "10",
      offset: "0",
    })
    await getVouchers()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/voucher/portal"
    )
    const input = { maxClaims: 5, expiresAt: "2026-12-31", amount: 20 }
    await createVoucher(input)
    expect(calledRequest().url.pathname).toBe("/api/billing/voucher/portal")
    expect(calledRequest().init?.method).toBe("POST")
    await getVoucherDetail("voucher-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/voucher/portal/voucher-1"
    )
    await getVoucherClaims("voucher-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/voucher/portal/voucher-1/claims"
    )
    await updateVoucher("voucher-1", { stackable: true })
    expect(calledRequest().init?.method).toBe("PATCH")
    await disableVoucher("voucher-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/voucher/portal/voucher-1/disable"
    )
  })

  it("builds promotion queries and mutation endpoints", async () => {
    await getAdminPromotions({
      kind: "PRODUCT_PROMOTION",
      status: "ACTIVE",
      prefix: "SPRING SALE",
      discountType: "PERCENTAGE",
      currencyPolicy: "CONVERT_AT_CHECKOUT",
      allowedPackageCode: "PRO",
      limit: 10,
      offset: 2,
      organizationId: "org-1",
    })
    expect(Object.fromEntries(calledRequest().url.searchParams)).toEqual({
      kind: "PRODUCT_PROMOTION",
      status: "ACTIVE",
      prefix: "SPRING SALE",
      discountType: "PERCENTAGE",
      currencyPolicy: "CONVERT_AT_CHECKOUT",
      allowedPackageCode: "PRO",
      limit: "10",
      offset: "2",
      organizationId: "org-1",
    })
    await getAdminPromotions()
    expect(calledRequest().url.href).toBe(
      "https://billing.test/api/billing/admin/promotions"
    )
    await createAdminPromotion({
      maxClaims: 1,
      expiresAt: "2026-12-31",
      kind: "PRODUCT_PROMOTION",
      discountType: "PERCENTAGE",
      discountValue: 15,
      currencyPolicy: "MATCH_CURRENCY_ONLY",
      allowedPackageCodes: ["VPN"],
      allowedBillingPeriods: ["MONTHLY"],
    })
    expect(calledRequest().init?.method).toBe("POST")
    await getAdminPromotion("promotion-1")
    await updateAdminPromotion("promotion-1", { allowUpgrade: true })
    expect(calledRequest().init?.method).toBe("PATCH")
    await publishAdminPromotion("promotion-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/promotions/promotion-1/publish"
    )
    await disableAdminPromotion("promotion-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/promotions/promotion-1/disable"
    )
    await getAdminPromotionClaims("promotion-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/promotions/promotion-1/claims"
    )
  })
})

describe("subscription lifecycle helpers", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetApiBaseUrl.mockClear()
    mockGetApiBaseUrl.mockReturnValue("https://billing.test")
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
  })

  it("posts cancellation, reinstatement, and plan changes", async () => {
    await cancelSubscription("sub-1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/subscriptions/sub-1/cancel"
    )
    expect(calledRequest().init?.body).toBe("{}")
    await cancelSubscription("sub-1", { reason: "Too expensive" })
    expect(calledRequest().init?.body).toBe(
      JSON.stringify({ reason: "Too expensive" })
    )
    await reinstateSubscription("sub-1", { reason: "Changed mind" })
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/subscriptions/sub-1/reinstate"
    )
    await previewChangePlan("sub-1", "pricing 1")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/subscriptions/sub-1/change-plan/preview"
    )
    expect(calledRequest().url.searchParams.get("pricingId")).toBe("pricing 1")
    await changePlan("sub-1", "pricing-2")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/subscriptions/sub-1/change-plan"
    )
    expect(calledRequest().init?.body).toBe(
      JSON.stringify({ pricingId: "pricing-2" })
    )
  })

  it("labels all supported billing periods and preserves unknown values", () => {
    expect(billingPeriodLabel("MONTHLY")).toBe("Monthly")
    expect(billingPeriodLabel("QUARTERLY")).toBe("Quarterly")
    expect(billingPeriodLabel("SEMI_ANNUAL")).toBe("Semi-Annual")
    expect(billingPeriodLabel("ANNUAL")).toBe("Annual")
    expect(billingPeriodLabel("CUSTOM")).toBe("CUSTOM")
    expect(billingPeriodLabel(null as never)).toBe("Unknown period")
  })

  it("calls admin catalog products list, detail, and upsert endpoints", async () => {
    await getAdminCatalogProductsList("APP_HOSTING")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/APP_HOSTING/products"
    )

    await getAdminCatalogProductDetail("APP_HOSTING", "STARTER")
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/APP_HOSTING/products/STARTER"
    )

    await upsertAdminCatalogProduct("APP_HOSTING", "STARTER", {
      name: "Starter Plan",
      billingStrategy: "FIXED_CYCLE",
      stockControl: "TRACKED",
      stockCount: 10,
      allowBackorder: false,
    })
    expect(calledRequest().url.pathname).toBe(
      "/api/billing/admin/catalog/APP_HOSTING/products/STARTER"
    )
    expect(calledRequest().init?.method).toBe("POST")
    expect(calledRequest().init?.body).toBe(
      JSON.stringify({
        name: "Starter Plan",
        billingStrategy: "FIXED_CYCLE",
        stockControl: "TRACKED",
        stockCount: 10,
        allowBackorder: false,
      })
    )
  })
})
