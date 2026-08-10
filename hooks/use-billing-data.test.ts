import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { AddonDetail } from "@/components/billing/admin/catalog/catalog-editor.types"
import type {
  AdminSubscriptionsResponse,
  BillingSubscriptions,
  CatalogProduct,
  InvoiceDetail,
} from "@/lib/billing-client"

type EdenResult<T> = {
  data?: T
  error?: { value?: { message?: string } }
}

type AdminAddonListResponse = {
  ok: true
  addons: unknown[]
  currency: string
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const adminSubscriptionsGet =
  mock<(options?: unknown) => Promise<EdenResult<AdminSubscriptionsResponse>>>()
const subscriptionsGet =
  mock<(options?: unknown) => Promise<EdenResult<BillingSubscriptions>>>()
const adminAddonsGet =
  mock<(options?: unknown) => Promise<EdenResult<AdminAddonListResponse>>>()
const adminAddonDetailGet =
  mock<
    (options?: unknown) => Promise<EdenResult<{ ok: true; addon: AddonDetail }>>
  >()
const invoiceGet = mock<() => Promise<EdenResult<InvoiceDetail>>>()
const catalogProductGet =
  mock<(options?: unknown) => Promise<EdenResult<CatalogProduct>>>()
const cancelPost = mock<(body: unknown) => Promise<EdenResult<unknown>>>()
const reinstatePost = mock<(body: unknown) => Promise<EdenResult<unknown>>>()
const planPreviewGet =
  mock<(options: unknown) => Promise<EdenResult<unknown>>>()
const planChangePost = mock<(body: unknown) => Promise<EdenResult<unknown>>>()
const useQueryMock = mock<(options: Record<string, unknown>) => unknown>()

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      billing: {
        admin: {
          subscriptions: { get: adminSubscriptionsGet },
          addons: {
            get: adminAddonsGet,
            ADDON_ONE: { get: adminAddonDetailGet },
          },
        },
        subscriptions: {
          get: subscriptionsGet,
          SUB_ONE: {
            cancel: { post: cancelPost },
            reinstate: { post: reinstatePost },
            "change-plan": {
              preview: { get: planPreviewGet },
              post: planChangePost,
            },
          },
        },
        invoices: { INV_ONE: { get: invoiceGet } },
        catalog: { APP_HOSTING: { get: catalogProductGet } },
      },
    },
  },
}))

mock.module("@tanstack/react-query", () => ({ useQuery: useQueryMock }))

const {
  cancelBillingSubscription,
  changeBillingPlan,
  fetchAdminAddon,
  fetchAdminAddons,
  fetchAdminSubscriptions,
  fetchCatalogProduct,
  fetchInvoice,
  fetchSubscriptions,
  previewBillingPlanChange,
  reinstateBillingSubscription,
  useAdminAddonQuery,
  useAdminAddonsQuery,
  useAdminSubscriptionsQuery,
  useCatalogProductQuery,
  useInvoiceQuery,
  useSubscriptionsQuery,
} = await import("./use-billing-data")

const subscriptionsResponse = {
  ok: true as const,
  subscriptions: [],
} satisfies BillingSubscriptions
const adminSubscriptionsResponse = {
  ok: true as const,
  subscriptions: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
} satisfies AdminSubscriptionsResponse
const adminAddonsResponse: AdminAddonListResponse = {
  ok: true,
  addons: [],
  currency: "IDR",
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
}
const adminAddonDetailResponse = {
  ok: true as const,
  addon: {
    id: "ADDON_ONE",
    code: "ADDON_ONE",
    name: "Addon One",
    description: null,
    billingMode: "RECURRING",
    isActive: true,
    prices: [
      {
        id: "PRICE_ONE",
        billingPeriod: "MONTHLY",
        currency: "USD",
        amount: "10.00",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
        isActive: true,
      },
    ],
    planAttachments: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies AddonDetail,
}
const product: CatalogProduct = {
  code: "APP_HOSTING",
  name: "App Hosting",
  description: "Application hosting",
  isActive: true,
  plans: [],
}
const invoiceResponse = {
  ok: true as const,
  invoice: { id: "INV_ONE" },
} as InvoiceDetail

describe("billing Eden query functions", () => {
  beforeEach(() => {
    adminSubscriptionsGet.mockClear()
    adminAddonsGet.mockClear()
    adminAddonDetailGet.mockClear()
    subscriptionsGet.mockClear()
    invoiceGet.mockClear()
    catalogProductGet.mockClear()
    cancelPost.mockClear()
    reinstatePost.mockClear()
    planPreviewGet.mockClear()
    planChangePost.mockClear()
    useQueryMock.mockClear()

    adminSubscriptionsGet.mockResolvedValue({
      data: adminSubscriptionsResponse,
    })
    adminAddonsGet.mockResolvedValue({ data: adminAddonsResponse })
    adminAddonDetailGet.mockResolvedValue({ data: adminAddonDetailResponse })
    subscriptionsGet.mockResolvedValue({ data: subscriptionsResponse })
    invoiceGet.mockResolvedValue({ data: invoiceResponse })
    catalogProductGet.mockResolvedValue({ data: product })
    cancelPost.mockResolvedValue({ data: { ok: true } })
    reinstatePost.mockResolvedValue({ data: { ok: true } })
    planPreviewGet.mockResolvedValue({ data: { ok: true, preview: true } })
    planChangePost.mockResolvedValue({ data: { ok: true } })
    useQueryMock.mockImplementation((options) => options)
  })

  it("loads subscriptions through the typed Eden endpoint", async () => {
    await expect(fetchSubscriptions()).resolves.toEqual(subscriptionsResponse)
    expect(subscriptionsGet).toHaveBeenCalledWith()
  })

  it("applies admin subscription defaults and optional filters", async () => {
    await fetchAdminSubscriptions({
      page: 2,
      limit: 50,
      status: "ACTIVE",
      orgId: "org-1",
    })
    expect(adminSubscriptionsGet).toHaveBeenCalledWith({
      $query: {
        page: "2",
        limit: "50",
        status: "ACTIVE",
        organizationId: "org-1",
      },
    })

    await fetchAdminSubscriptions()
    expect(adminSubscriptionsGet).toHaveBeenLastCalledWith({
      $query: { page: "1", limit: "20" },
    })
  })

  it("rejects admin subscriptions with the Eden message or fallback", async () => {
    adminSubscriptionsGet.mockResolvedValueOnce({
      error: { value: { message: "admin subscriptions failed" } },
    })
    await expect(fetchAdminSubscriptions()).rejects.toThrow(
      "admin subscriptions failed"
    )

    adminSubscriptionsGet.mockResolvedValueOnce({ data: undefined })
    await expect(fetchAdminSubscriptions()).rejects.toThrow(
      "Unable to load subscriptions."
    )
  })

  it("applies admin add-on defaults and all optional query parameters", async () => {
    await fetchAdminAddons({
      page: 3,
      limit: 10,
      search: "backup",
      billingMode: "RECURRING",
      isActive: false,
      currency: "USD",
    })
    expect(adminAddonsGet).toHaveBeenCalledWith({
      $query: {
        page: "3",
        limit: "10",
        currency: "USD",
        search: "backup",
        billingMode: "RECURRING",
        isActive: "false",
      },
    })

    await fetchAdminAddons()
    expect(adminAddonsGet).toHaveBeenLastCalledWith({
      $query: { page: "1", limit: "20", currency: "IDR" },
    })
  })

  it("loads an admin add-on detail with the selected or default currency", async () => {
    await expect(fetchAdminAddon("ADDON_ONE", "USD")).resolves.toEqual(
      adminAddonDetailResponse
    )
    expect(adminAddonDetailGet).toHaveBeenCalledWith({
      $query: { currency: "USD" },
    })

    await fetchAdminAddon("ADDON_ONE")
    expect(adminAddonDetailGet).toHaveBeenLastCalledWith({
      $query: { currency: "IDR" },
    })
  })

  it("turns admin add-on errors into rejected queries", async () => {
    adminAddonsGet.mockResolvedValueOnce({
      error: { value: { message: "Unable to load add-ons" } },
    })
    await expect(fetchAdminAddons()).rejects.toThrow("Unable to load add-ons")

    adminAddonDetailGet.mockResolvedValueOnce({ data: undefined })
    await expect(fetchAdminAddon("ADDON_ONE")).rejects.toThrow(
      "Unable to load add-on."
    )
  })

  it("loads invoices and supports catalog requests with or without currency", async () => {
    await expect(fetchInvoice("INV_ONE")).resolves.toEqual(invoiceResponse)
    expect(invoiceGet).toHaveBeenCalledWith()

    await expect(fetchCatalogProduct("APP_HOSTING")).resolves.toEqual(product)
    expect(catalogProductGet).toHaveBeenCalledWith({ $query: undefined })
    await fetchCatalogProduct("APP_HOSTING", "USD")
    expect(catalogProductGet).toHaveBeenLastCalledWith({
      $query: { currency: "USD" },
    })
  })

  it("uses endpoint-specific fallback errors for invoice and catalog", async () => {
    invoiceGet.mockResolvedValueOnce({ data: undefined })
    await expect(fetchInvoice("INV_ONE")).rejects.toThrow(
      "Unable to load invoice."
    )
    await expect(fetchInvoice("UNKNOWN")).rejects.toThrow(
      "Invoice not found: UNKNOWN"
    )
    catalogProductGet.mockResolvedValueOnce({
      error: { value: { message: "catalog unavailable" } },
    })
    await expect(fetchCatalogProduct("APP_HOSTING")).rejects.toThrow(
      "catalog unavailable"
    )
  })

  it("runs subscription lifecycle mutations with optional reasons", async () => {
    await expect(
      cancelBillingSubscription("SUB_ONE", "too expensive")
    ).resolves.toEqual({
      ok: true,
    })
    expect(cancelPost).toHaveBeenCalledWith({ reason: "too expensive" })

    await expect(reinstateBillingSubscription("SUB_ONE")).resolves.toEqual({
      ok: true,
    })
    expect(reinstatePost).toHaveBeenCalledWith({ reason: undefined })
  })

  it("previews and commits a subscription plan change", async () => {
    await expect(
      previewBillingPlanChange("SUB_ONE", "pricing-new")
    ).resolves.toEqual({ ok: true, preview: true })
    expect(planPreviewGet).toHaveBeenCalledWith({
      $query: { pricingId: "pricing-new" },
    })

    await expect(changeBillingPlan("SUB_ONE", "pricing-new")).resolves.toEqual({
      ok: true,
    })
    expect(planChangePost).toHaveBeenCalledWith({ pricingId: "pricing-new" })
  })

  it("uses mutation-specific errors instead of hiding failed lifecycle calls", async () => {
    cancelPost.mockResolvedValueOnce({ data: undefined })
    await expect(cancelBillingSubscription("SUB_ONE")).rejects.toThrow(
      "Unable to cancel subscription."
    )
    reinstatePost.mockResolvedValueOnce({
      error: { value: { message: "reinstate failed" } },
    })
    await expect(reinstateBillingSubscription("SUB_ONE")).rejects.toThrow(
      "reinstate failed"
    )
    planPreviewGet.mockResolvedValueOnce({ data: undefined })
    await expect(
      previewBillingPlanChange("SUB_ONE", "pricing-new")
    ).rejects.toThrow("Could not preview this plan change.")
    planChangePost.mockResolvedValueOnce({ data: undefined })
    await expect(changeBillingPlan("SUB_ONE", "pricing-new")).rejects.toThrow(
      "Unable to change plan."
    )
  })

  it("configures every query wrapper key, fetcher, and enabled gate", () => {
    expect(useSubscriptionsQuery()).toMatchObject({
      queryKey: ["billing", "subscriptions"],
      queryFn: fetchSubscriptions,
    })
    expect(useAdminSubscriptionsQuery({ status: "ACTIVE" })).toMatchObject({
      queryKey: ["billing", "admin", "subscriptions", { status: "ACTIVE" }],
    })
    expect(useInvoiceQuery(undefined)).toMatchObject({
      queryKey: ["billing", "invoice", undefined],
      enabled: false,
    })
    expect(useInvoiceQuery("INV_ONE")).toMatchObject({
      queryKey: ["billing", "invoice", "INV_ONE"],
      enabled: true,
    })
    expect(useCatalogProductQuery(undefined)).toMatchObject({
      queryKey: ["billing", "catalog", undefined, undefined],
      enabled: false,
    })
    expect(useCatalogProductQuery("APP_HOSTING", "USD")).toMatchObject({
      queryKey: ["billing", "catalog", "APP_HOSTING", "USD"],
      enabled: true,
    })
    expect(useAdminAddonsQuery()).toMatchObject({
      queryKey: ["billing", "admin", "addons", {}],
    })
    expect(useAdminAddonQuery(undefined)).toMatchObject({
      queryKey: ["billing", "admin", "addon", undefined, "IDR"],
      enabled: false,
    })
    expect(useAdminAddonQuery("ADDON_ONE", "USD")).toMatchObject({
      queryKey: ["billing", "admin", "addon", "ADDON_ONE", "USD"],
      enabled: true,
    })
    expect(useQueryMock).toHaveBeenCalledTimes(9)
  })
})
