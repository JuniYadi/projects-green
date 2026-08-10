"use client"

import { useQuery } from "@tanstack/react-query"

import { eden } from "@/lib/eden"
import type {
  AdminSubscriptionsResponse,
  BillingSubscriptions,
  InvoiceDetail,
  CatalogProduct,
} from "@/lib/billing-client"
import type {
  AddonDetail,
  AddonListItem,
} from "@/components/billing/admin/catalog/catalog-editor.types"

type BillingApiError = {
  message?: string
}

type EdenResult<T> = {
  data?: T
  error?: { value?: BillingApiError }
}

type AdminAddonListItem = Omit<AddonListItem, "priceCount"> & {
  prices: Array<{
    id: string
    billingPeriod: string
    currency: string
    amount: string
  }>
}

type AdminAddonListResponse = {
  ok: true
  addons: AdminAddonListItem[]
  currency: string
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
type AdminAddonDetailResponse = {
  ok: true
  addon: AddonDetail
}

const queryError = (result: EdenResult<unknown>, fallback: string) =>
  result.error?.value?.message ?? fallback

const unwrap = <T>(result: EdenResult<T>, fallback: string): T => {
  if (result.data) return result.data
  throw new Error(queryError(result, fallback))
}

type AdminSubscriptionParams = {
  page?: number
  limit?: number
  status?: string
  orgId?: string
}

type BillingApi = {
  billing: {
    subscriptions: {
      get: (options?: unknown) => Promise<EdenResult<BillingSubscriptions>>
    }
    admin: {
      subscriptions: {
        get: (
          options?: unknown
        ) => Promise<EdenResult<AdminSubscriptionsResponse>>
      }
      addons: {
        get: (options?: unknown) => Promise<EdenResult<AdminAddonListResponse>>
        [code: string]: unknown
      }
    }
    invoices: {
      [id: string]: { get: () => Promise<EdenResult<InvoiceDetail>> }
    }
    catalog: {
      [code: string]: {
        get: (options?: unknown) => Promise<EdenResult<CatalogProduct>>
      }
    }
  }
}

const billingApi = (eden.api as unknown as BillingApi).billing

export async function fetchSubscriptions(): Promise<BillingSubscriptions> {
  return unwrap(
    await billingApi.subscriptions.get(),
    "Unable to load subscriptions."
  )
}

export async function fetchAdminSubscriptions(
  params: AdminSubscriptionParams = {}
): Promise<AdminSubscriptionsResponse> {
  const query: Record<string, string> = {
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  }
  if (params.status) query.status = params.status
  if (params.orgId) query.organizationId = params.orgId

  return unwrap(
    await billingApi.admin.subscriptions.get({ $query: query }),
    "Unable to load subscriptions."
  )
}

export async function fetchAdminAddons(
  params: {
    page?: number
    limit?: number
    search?: string
    billingMode?: string
    isActive?: boolean
    currency?: string
  } = {}
): Promise<AdminAddonListResponse> {
  const query: Record<string, string> = {
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
    currency: params.currency ?? "IDR",
  }
  if (params.search) query.search = params.search
  if (params.billingMode) query.billingMode = params.billingMode
  if (params.isActive !== undefined) query.isActive = String(params.isActive)

  return unwrap(
    await billingApi.admin.addons.get({ $query: query }),
    "Unable to load add-ons."
  )
}

export async function fetchAdminAddon(
  code: string,
  currency = "IDR"
): Promise<AdminAddonDetailResponse> {
  const get = billingApi.admin.addons[code] as {
    get: (options?: unknown) => Promise<EdenResult<AdminAddonDetailResponse>>
  }
  return unwrap(
    await get.get({ $query: { currency } }),
    "Unable to load add-on."
  )
}

export function useSubscriptionsQuery() {
  return useQuery({
    queryKey: ["billing", "subscriptions"],
    queryFn: fetchSubscriptions,
  })
}

export function useAdminSubscriptionsQuery(params: AdminSubscriptionParams) {
  return useQuery({
    queryKey: ["billing", "admin", "subscriptions", params],
    queryFn: () => fetchAdminSubscriptions(params),
  })
}
export async function fetchInvoice(id: string): Promise<InvoiceDetail> {
  const invoiceApi = billingApi.invoices[id]
  if (!invoiceApi) throw new Error(`Invoice not found: ${id}`)
  const result = await invoiceApi.get()
  return unwrap(result, "Unable to load invoice.")
}

export async function fetchCatalogProduct(
  code: string,
  currency?: string
): Promise<CatalogProduct> {
  const get = billingApi.catalog[code].get
  return unwrap(
    await get({ $query: currency ? { currency } : undefined }),
    "Unable to load catalog product."
  )
}

type SubscriptionMutationApi = {
  cancel: { post: (body: unknown) => Promise<EdenResult<unknown>> }
  reinstate: { post: (body: unknown) => Promise<EdenResult<unknown>> }
  "change-plan": {
    preview: { get: (options: unknown) => Promise<EdenResult<unknown>> }
    post: (body: unknown) => Promise<EdenResult<unknown>>
  }
}

const subscriptionMutationApi = (id: string) =>
  (billingApi.subscriptions as unknown as Record<string, unknown>)[
    id
  ] as SubscriptionMutationApi

export async function cancelBillingSubscription(id: string, reason?: string) {
  return unwrap(
    await subscriptionMutationApi(id).cancel.post({ reason }),
    "Unable to cancel subscription."
  )
}

export async function reinstateBillingSubscription(
  id: string,
  reason?: string
) {
  return unwrap(
    await subscriptionMutationApi(id).reinstate.post({ reason }),
    "Unable to reinstate subscription."
  )
}

export async function previewBillingPlanChange(id: string, pricingId: string) {
  return unwrap(
    await subscriptionMutationApi(id)["change-plan"].preview.get({
      $query: { pricingId },
    }),
    "Could not preview this plan change."
  )
}

export async function changeBillingPlan(id: string, pricingId: string) {
  return unwrap(
    await subscriptionMutationApi(id)["change-plan"].post({ pricingId }),
    "Unable to change plan."
  )
}

export function useInvoiceQuery(id: string | undefined) {
  return useQuery({
    queryKey: ["billing", "invoice", id],
    queryFn: () => fetchInvoice(id as string),
    enabled: Boolean(id),
  })
}

export function useCatalogProductQuery(
  code: string | undefined,
  currency?: string
) {
  return useQuery({
    queryKey: ["billing", "catalog", code, currency],
    queryFn: () => fetchCatalogProduct(code as string, currency),
    enabled: Boolean(code),
  })
}

export function useAdminAddonsQuery(
  params: Parameters<typeof fetchAdminAddons>[0] = {}
) {
  return useQuery({
    queryKey: ["billing", "admin", "addons", params],
    queryFn: () => fetchAdminAddons(params),
  })
}

export function useAdminAddonQuery(code: string | undefined, currency = "IDR") {
  return useQuery({
    queryKey: ["billing", "admin", "addon", code, currency],
    queryFn: () => fetchAdminAddon(code as string, currency),
    enabled: Boolean(code),
  })
}
