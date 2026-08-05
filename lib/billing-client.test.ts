import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockFetch = mock()
const mockGetApiBaseUrl = mock(() => "https://billing.test")
// @ts-expect-error — mock replaces global fetch for testing
globalThis.fetch = mockFetch

mock.module("@/lib/eden", () => ({ getApiBaseUrl: mockGetApiBaseUrl }))

import {
  addBillingContact,
  adminTopup,
  createAdminPricing,
  deactivateAdminPricing,
  deactivateBillingContact,
  getAdminAdjustments,
  getAdminBillingContacts,
  getAdminInvoices,
  getAdminMember,
  getAdminMembers,
  getAdminOrgDetail,
  getAdminOrgs,
  getAdminOrders,
  getAdminPricing,
  getAdminStats,
  getAdminSubscriptions,
  getAdminUsage,
  getAdminAuditLogs,
  refreshAdminOrgMetadata,
  updateAdminPricing,
  updateBillingAlerts,
  updateBillingContact,
  updateBillingCurrency,
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
})
