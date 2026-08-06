// Billing API client types and fetch helpers
import { getApiBaseUrl } from "@/lib/eden"

export type BillingAccount = {
  ok: true
  tenantId: string
  currency: string
  balanceIdr: string
  formattedBalance: string
  isAboveWarn: boolean
  isPositive: boolean
  accountAge: string
}

export type SubscriptionItem = {
  id: string
  packageCode: string
  planCode: string
  regionCode: string
  billingMode: string
  type: string
  status: string
  allocatedConfig: Record<string, unknown> | null
  monthlyRateIdr?: string
  pricingId?: string | null
  billingPeriod?:
    | "MONTHLY"
    | "QUARTERLY"
    | "SEMI_ANNUAL"
    | "ANNUAL"
    | string
    | null
  periodMonths?: number | null
  periodPrice?: string | null
  currency?: string | null
  quantity?: string | number | null
  currentPeriodStart?: string | null
  currentPeriodEnd: string | null
  orderId?: string | null
  orderStatus?: string | null
  billingInvoiceId?: string | null
  invoiceStatus?: string | null
  fulfillment?: Record<string, unknown> | null
  quotaIn?: number | null
  quotaOut?: number | null
  dailyPerDevice?: number | null
}

export type BillingSubscriptions = {
  ok: true
  subscriptions: SubscriptionItem[]
}

export type InvoiceOrderItem = {
  orderId: string
  pricingId: string | null
  packageCode: string
  planCode: string
  billingPeriod: string
  periodMonths: number
  periodPrice: string
  currency: string
  quantity: string
  currentPeriodStart: string
  currentPeriodEnd: string
  orderStatus: string
  billingInvoiceId: string
  invoiceStatus: string
}

export type InvoiceLineItem = {
  description: string
  quantity: string
  unitPriceIdr: string
  amountIdr: string
  currency: string
  category?: string
  metadata?: Record<string, unknown>
}

export type InvoiceListItem = {
  id: string
  invoiceNumber: string
  status: string
  type?: string | null
  paymentMethod?: string | null
  paymentUrl?: string | null
  issuedAt: string | null
  dueAt: string | null
  createdAt?: string | null
  dueDate?: string | null
  periodStart: string
  periodEnd: string
  subtotalAmountIdr?: string
  taxAmountIdr?: string
  discountAmountIdr?: string
  totalAmountIdr: string
  currency: string
  orders?: InvoiceOrderItem[]
  lines?: InvoiceLineItem[]
}

export type BillingInvoices = {
  ok: true
  invoices: InvoiceListItem[]
}

export type InvoiceDetail = {
  ok: true
  invoice: InvoiceListItem
}

export type TopupInput = {
  amount: number
  paymentMethod: "manual_bank_transfer"
  referenceId?: string
}

export type TopupSuccessResponse = {
  ok: true
  adjustmentId: string
  newBalanceIdr: string
  amountIdr: string
  type: "CREDIT"
}

export type PayWithBalanceResponse = {
  ok: true
  message: string
}

export type TopupAndPayResponse = {
  ok: true
  message: string
  topupRequired: boolean
  gapAmount?: number
  topupInvoiceId?: string
  topupInvoiceNumber?: string
  totalDue?: number
  currentBalance?: number
  shortfall?: number
}

export type ApiErrorResponse = {
  ok: false
  error: string
  message: string
  fieldErrors?: Record<string, string[]>
}

// Payment Method types

export type PaymentMethod = {
  id: string
  bankCode: string
  bankName: string
  accountName: string
  accountNumber: string
  supportedCurrencies?: string[]
  isActive: boolean
  isDefault: boolean
}

export const getPaymentMethodCurrencies = (method: PaymentMethod): string[] =>
  method.supportedCurrencies && method.supportedCurrencies.length > 0
    ? method.supportedCurrencies
    : []

export type PaymentMethodsResponse = {
  ok: true
  accounts: PaymentMethod[]
}

async function fetchBilling<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  const data = (await response.json()) as T | ApiErrorResponse

  if (!response.ok || (data as ApiErrorResponse).ok === false) {
    const errorData = data as ApiErrorResponse
    throw new Error(
      errorData.message || `Billing API error: ${response.status}`
    )
  }

  return data as T
}

export async function getAccount(
  options?: RequestInit
): Promise<BillingAccount> {
  return fetchBilling<BillingAccount>("/api/billing/account", options)
}

export async function getSubscriptions(): Promise<BillingSubscriptions> {
  return fetchBilling<BillingSubscriptions>("/api/billing/subscriptions")
}

export async function getInvoices(
  params?: URLSearchParams
): Promise<BillingInvoices> {
  const endpoint = params
    ? `/api/billing/invoices?${params.toString()}`
    : "/api/billing/invoices"
  return fetchBilling<BillingInvoices>(endpoint)
}

export async function getInvoice(
  id: string,
  options?: RequestInit
): Promise<InvoiceDetail> {
  return fetchBilling<InvoiceDetail>(`/api/billing/invoices/${id}`, options)
}

export async function topup(input: TopupInput): Promise<TopupSuccessResponse> {
  return fetchBilling<TopupSuccessResponse>("/api/billing/topup", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function payWithBalance(
  invoiceId: string
): Promise<PayWithBalanceResponse> {
  return fetchBilling<PayWithBalanceResponse>(
    "/api/payments/invoice/pay-with-balance",
    {
      method: "POST",
      body: JSON.stringify({ invoiceId }),
    }
  )
}

export async function topupAndPay(
  invoiceId: string
): Promise<TopupAndPayResponse> {
  return fetchBilling<TopupAndPayResponse>(
    "/api/payments/invoice/topup-and-pay",
    {
      method: "POST",
      body: JSON.stringify({ invoiceId }),
    }
  )
}

// Payment Methods API

export async function getPaymentMethods(): Promise<PaymentMethodsResponse> {
  return fetchBilling<PaymentMethodsResponse>("/api/payments/bank-accounts")
}

export async function setDefaultPaymentMethod(
  id: string
): Promise<{ ok: true; account: PaymentMethod }> {
  return fetchBilling<{ ok: true; account: PaymentMethod }>(
    `/api/payments/bank-accounts/${id}/default`,
    {
      method: "PATCH",
    }
  )
}

export async function removePaymentMethod(
  id: string
): Promise<{ ok: true; message: string }> {
  return fetchBilling<{ ok: true; message: string }>(
    `/api/payments/bank-accounts/${id}`,
    {
      method: "DELETE",
    }
  )
}

// Admin billing types

export type AdminMember = {
  userId: string
  name: string
  email: string
  role: string
  subscriptionCount: number
  activeSubscriptionCount: number
  monthlySpendIdr: string
}

export type AdminMemberDetail = {
  userId: string
  name: string
  email: string
  role: string
  subscriptions: Array<{
    id: string
    packageCode: string
    packageName: string
    planCode: string
    planName: string
    status: string
  }>
  adjustments: Array<{
    id: string
    type: string
    amountIdr: string
    reason: string | null
    createdAt: string
  }>
}

export type AdminAdjustment = {
  id: string
  type: string
  amountIdr: string
  currency: string
  reason: string | null
  createdByWorkosUserId: string | null
  createdAt: string
}

export type AdjustmentsResponse = {
  ok: true
  adjustments: AdminAdjustment[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Admin billing functions

export async function getAdminMembers(params?: {
  orgId?: string
}): Promise<{ ok: true; members: AdminMember[] }> {
  const searchParams = new URLSearchParams()
  if (params?.orgId) searchParams.set("orgId", params.orgId)
  const qs = searchParams.toString()
  return fetchBilling<{ ok: true; members: AdminMember[] }>(
    `/api/billing/admin/members${qs ? `?${qs}` : ""}`
  )
}

export async function getAdminMember(
  userId: string
): Promise<AdminMemberDetail> {
  return fetchBilling<AdminMemberDetail>(`/api/billing/admin/members/${userId}`)
}

export async function getAdminAdjustments(params?: {
  type?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
  orgId?: string
}): Promise<AdjustmentsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set("type", params.type)
  if (params?.startDate) searchParams.set("startDate", params.startDate)
  if (params?.endDate) searchParams.set("endDate", params.endDate)
  if (params?.page !== undefined) searchParams.set("page", String(params.page))
  if (params?.limit !== undefined)
    searchParams.set("limit", String(params.limit))
  if (params?.orgId) searchParams.set("orgId", params.orgId)

  const endpoint = searchParams.toString()
    ? `/api/billing/admin/adjustments?${searchParams.toString()}`
    : "/api/billing/admin/adjustments"

  return fetchBilling<AdjustmentsResponse>(endpoint)
}

// ─── Admin Invoices ─────────────────────────────────────────────────────────

export type AdminInvoiceListItem = {
  id: string
  invoiceNumber: string
  status: string
  subtotalAmountIdr: string
  taxAmountIdr: string
  discountAmountIdr: string
  totalAmountIdr: string
  currency: string
  issuedAt: string | null
  dueAt: string | null
  paidAt: string | null
  createdAt: string
  organizationId: string | null
}

export type AdminInvoicesResponse = {
  ok: true
  invoices: AdminInvoiceListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export async function getAdminInvoices(params?: {
  page?: number
  limit?: number
  status?: string
  organizationId?: string
}): Promise<AdminInvoicesResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.status) searchParams.set("status", params.status)
  if (params?.organizationId)
    searchParams.set("organizationId", params.organizationId)

  const endpoint = searchParams.toString()
    ? `/api/billing/admin/invoices?${searchParams.toString()}`
    : "/api/billing/admin/invoices"

  return fetchBilling<AdminInvoicesResponse>(endpoint)
}

// ─── Admin Subscriptions ─────────────────────────────────────────────────────

export type AdminSubscriptionItem = {
  id: string
  organizationId: string | null
  packageCode: string
  planCode: string
  regionCode: string
  billingMode: string
  type: string
  status: string
  allocatedConfig: Record<string, unknown> | null
  monthlyRateIdr?: string
  pricingId?: string | null
  billingPeriod?: string | null
  periodMonths?: number | null
  periodPrice?: string | null
  currency?: string | null
  quantity?: string | number | null
  currentPeriodStart?: string | null
  currentPeriodEnd: string | null
  orderId?: string | null
  orderStatus?: string | null
  billingInvoiceId?: string | null
  invoiceStatus?: string | null
  fulfillment?: Record<string, unknown> | null
}

export type AdminSubscriptionsResponse = {
  ok: true
  subscriptions: AdminSubscriptionItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getAdminSubscriptions(params?: {
  page?: number
  limit?: number
  status?: string
  orgId?: string
}): Promise<AdminSubscriptionsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.status) searchParams.set("status", params.status)
  if (params?.orgId) searchParams.set("orgId", params.orgId)

  const endpoint = searchParams.toString()
    ? `/api/billing/admin/subscriptions?${searchParams.toString()}`
    : "/api/billing/admin/subscriptions"

  return fetchBilling<AdminSubscriptionsResponse>(endpoint)
}

// ─── Admin Stats ────────────────────────────────────────────────────────

export type AdminStats = {
  ok: true
  totalBalances: Record<"IDR" | "USD", string>
  activeOrgs: number
  totalSpend: string
  lowBalanceOrgs: number
  openInvoices: number
  openTickets: number
}

// ─── Admin Orgs ─────────────────────────────────────────────────────────

export type AdminOrgSummary = {
  orgId: string
  orgName: string
  balance: string
  currency: string
  activeSubscriptions: number
  monthlySpend: string
  lastTopUp: string | null
  openTicketCount: number
  ownerUserId: string | null
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  metadataRefreshedAt: string | null
}

export type AdminOrgsResponse = {
  ok: true
  orgs: AdminOrgSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Admin Org Detail ───────────────────────────────────────────────────

export type AdminOrgDetail = {
  ok: true
  org: {
    orgId: string
    orgName: string
    balance: string
    currency: string
    status: string
    createdAt: string
    subscriptions: {
      id: string
      packageCode: string
      planCode: string
      status: string
      billingMode: string
    }[]
    contacts: number
    monthlySpend: string
    recentInvoices: {
      id: string
      invoiceNumber: string
      status: string
      totalAmountIdr: string
      currency: string
      createdAt: string
    }[]
  }
}

// ─── Admin Topup ────────────────────────────────────────────────────────

export type AdminTopupInput = {
  orgId: string
  amount: number
  reason?: string
}

export type AdminTopupResponse = {
  ok: true
  adjustmentId: string
  newBalanceIdr: string
  amountIdr: string
  type: "CREDIT"
}

// ─── Admin Stats ───────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  return fetchBilling<AdminStats>("/api/billing/admin/stats")
}

// ─── Admin Orgs ─────────────────────────────────────────────────────────

export async function getAdminOrgs(params?: {
  page?: number
  limit?: number
  search?: string
  currency?: string
}): Promise<AdminOrgsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.search) searchParams.set("search", params.search)
  if (params?.currency) searchParams.set("currency", params.currency)
  const qs = searchParams.toString()
  return fetchBilling<AdminOrgsResponse>(
    `/api/billing/admin/orgs${qs ? `?${qs}` : ""}`
  )
}

export async function refreshAdminOrgMetadata(params: {
  orgIds: string[]
}): Promise<{ ok: true; refreshed: number }> {
  return fetchBilling<{ ok: true; refreshed: number }>(
    "/api/billing/admin/orgs/metadata/refresh",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  )
}

// ─── Admin Org Detail ───────────────────────────────────────────────────

export async function getAdminOrgDetail(
  orgId: string
): Promise<AdminOrgDetail> {
  return fetchBilling<AdminOrgDetail>(`/api/billing/admin/orgs/${orgId}`)
}

// ─── Admin Topup ────────────────────────────────────────────────────────

export async function adminTopup(
  input: AdminTopupInput
): Promise<AdminTopupResponse> {
  return fetchBilling<AdminTopupResponse>("/api/billing/admin/topup", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// ─── Admin Usage ─────────────────────────────────────────────────────────────

export type AdminUsageBreakdown = {
  category: string
  quantity: number
  totalCost: number
  percentage: number
}

export type AdminUsageTrend = {
  date: string
  amount: number
}

export type AdminUsageResponse = {
  ok: true
  data: {
    breakdown: AdminUsageBreakdown[]
    trend: AdminUsageTrend[]
  }
}

export async function getAdminUsage(params?: {
  days?: number
  orgId?: string
}): Promise<AdminUsageResponse> {
  const searchParams = new URLSearchParams()
  if (params?.days) searchParams.set("days", String(params.days))
  if (params?.orgId) searchParams.set("orgId", params.orgId)

  const endpoint = searchParams.toString()
    ? `/api/billing/admin/usage?${searchParams.toString()}`
    : "/api/billing/admin/usage"

  return fetchBilling<AdminUsageResponse>(endpoint)
}

// ─── Billing Contacts ──────────────────────────────────────────────────────────

export type BillingContactDTO = {
  id: string
  billingAccountId: string
  email: string
  name: string | null
  role: "OWNER" | "FINANCE" | "ACCOUNTING" | "GENERAL"
  notifyOnInvoice: boolean
  notifyOnLowBalance: boolean
  notifyOnSupport: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type AlertPreferences = {
  balanceThresholdEnabled: boolean
  balanceThresholdAmount: number
  usageThresholdEnabled: boolean
  usageThresholdAmount: number
}

export type BillingAccountDetail = {
  ok: true
  id: string
  organizationId: string
  tenantId: string | null
  preferredCurrency: "USD" | "IDR"
  timezone: string
  status: string
  balance: number
  createdAt: string
  updatedAt: string
  contacts: BillingContactDTO[]
  alertPreferences: AlertPreferences
}

export type UpdateContactInput = {
  name?: string | null
  notifyOnInvoice?: boolean
  notifyOnLowBalance?: boolean
  notifyOnSupport?: boolean
  isActive?: boolean
}

export type CreateContactInput = {
  email: string
  name?: string
  role?: "FINANCE" | "ACCOUNTING" | "GENERAL"
  notifyOnInvoice?: boolean
  notifyOnLowBalance?: boolean
  notifyOnSupport?: boolean
}

export async function getBillingAccount(): Promise<BillingAccountDetail> {
  return fetchBilling<BillingAccountDetail>("/api/billing/account/detail")
}

export type AdminBillingContactsResponse = {
  ok: true
  id: string
  organizationId: string
  contacts: BillingContactDTO[]
}

export async function getAdminBillingContacts(
  orgId: string
): Promise<AdminBillingContactsResponse> {
  return fetchBilling<AdminBillingContactsResponse>(
    `/api/billing/admin/orgs/${orgId}/contacts`
  )
}

export async function addBillingContact(
  input: CreateContactInput
): Promise<{ ok: true } & BillingContactDTO> {
  return fetchBilling<{ ok: true } & BillingContactDTO>(
    "/api/billing/contacts",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}

export async function updateBillingContact(
  contactId: string,
  input: UpdateContactInput
): Promise<{ ok: true } & BillingContactDTO> {
  return fetchBilling<{ ok: true } & BillingContactDTO>(
    `/api/billing/contacts/${contactId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  )
}

export async function deactivateBillingContact(
  contactId: string
): Promise<{ ok: true }> {
  return fetchBilling<{ ok: true }>(`/api/billing/contacts/${contactId}`, {
    method: "DELETE",
  })
}

export async function updateBillingCurrency(
  preferredCurrency: "USD" | "IDR"
): Promise<{ ok: true; preferredCurrency: "USD" | "IDR" }> {
  return fetchBilling<{ ok: true; preferredCurrency: "USD" | "IDR" }>(
    "/api/billing/currency",
    {
      method: "PATCH",
      body: JSON.stringify({ preferredCurrency }),
    }
  )
}

export type AlertPreferencesInput = Partial<AlertPreferences>

export async function updateBillingAlerts(
  input: AlertPreferencesInput
): Promise<BillingAccountDetail> {
  return fetchBilling<BillingAccountDetail>("/api/billing/alerts", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}
// ─── Admin Audit Logs ─────────────────────────────────────────────────────────

export type AdminAuditLogItem = {
  id: string
  billingAccountId: string | null
  billingRunId: string | null
  entityType: string
  entityId: string
  action: string
  actorType: string
  actorId: string | null
  contextJson: Record<string, unknown> | null
  createdAt: string
}

export type AdminAuditLogsResponse = {
  ok: true
  logs: AdminAuditLogItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export async function getAdminAuditLogs(params?: {
  page?: number
  limit?: number
  entityType?: string
  entityId?: string
  billingAccountId?: string
}): Promise<AdminAuditLogsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.entityType) searchParams.set("entityType", params.entityType)
  if (params?.entityId) searchParams.set("entityId", params.entityId)
  if (params?.billingAccountId)
    searchParams.set("billingAccountId", params.billingAccountId)

  const endpoint = searchParams.toString()
    ? `/api/billing/admin/billing-audit/logs?${searchParams.toString()}`
    : "/api/billing/admin/billing-audit/logs"

  return fetchBilling<AdminAuditLogsResponse>(endpoint)
}

// ─── Admin Pricing and Orders ───────────────────────────────────────────────
export type AdminPricing = {
  id: string
  planId: string
  regionId: string
  packageCode: string
  planCode: string
  regionCode: string
  type: string
  billingMode: string
  billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | null
  periodPrice: string | null
  currency: string
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

export type AdminPricingResponse = {
  ok: true
  data: AdminPricing[]
  pricing?: AdminPricing[]
}

export type AdminOrderLine = {
  id: string
  pricingId: string | null
  packageCode: string
  planCode: string
  regionCode: string
  billingPeriod: string
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  quantity: string
  unitPrice: string
  amount: string
  currency: string
  periodStart: string
  periodEnd: string
}

export type AdminOrder = {
  id: string
  organizationId: string
  billingAccountId: string
  serviceSubscriptionId: string | null
  billingInvoiceId: string | null
  status: string
  currency: string
  subtotalAmount: string
  totalAmount: string
  idempotencyKey: string
  chargedAt: string | null
  fulfilledAt: string | null
  createdAt: string
  updatedAt: string
  line: AdminOrderLine | null
  subscription: {
    id: string
    status: string
    packageCode: string
    planCode: string
    currentPeriodStart: string
    currentPeriodEnd: string
  } | null
  invoice: {
    id: string
    invoiceNumber: string
    status: string
    paidAt: string | null
  } | null
}

export type AdminOrdersResponse = {
  ok: true
  orders: AdminOrder[]
  data?: AdminOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export function billingPeriodLabel(
  period: AdminPricing["billingPeriod"] | string
): string {
  switch (period) {
    case "MONTHLY":
      return "Monthly"
    case "QUARTERLY":
      return "Quarterly"
    case "SEMI_ANNUAL":
      return "Semi-Annual"
    case "ANNUAL":
      return "Annual"
    default:
      return period ?? "Unknown period"
  }
}

export async function getAdminPricing(params?: {
  packageCode?: string
  planCode?: string
  regionCode?: string
  billingPeriod?: AdminPricing["billingPeriod"]
  currency?: string
  includeInactive?: boolean
}): Promise<AdminPricingResponse> {
  const query = new URLSearchParams()
  if (params?.packageCode) query.set("packageCode", params.packageCode)
  if (params?.planCode) query.set("planCode", params.planCode)
  if (params?.regionCode) query.set("regionCode", params.regionCode)
  if (params?.billingPeriod) query.set("billingPeriod", params.billingPeriod)
  if (params?.currency) query.set("currency", params.currency)
  if (params?.includeInactive !== undefined)
    query.set("includeInactive", String(params.includeInactive))
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return fetchBilling<AdminPricingResponse>(
    `/api/billing/admin/pricing${suffix}`
  )
}

export async function createAdminPricing(input: {
  planId: string
  regionId: string
  billingPeriod: Exclude<AdminPricing["billingPeriod"], null>
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  periodPrice: string | number
  currency: string
  effectiveFrom: string
  effectiveTo?: string
  isActive?: boolean
}): Promise<{ ok: true; data: AdminPricing }> {
  return fetchBilling(`/api/billing/admin/pricing`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function updateAdminPricing(
  id: string,
  input: Partial<Parameters<typeof createAdminPricing>[0]>
): Promise<{ ok: true; data: AdminPricing }> {
  return fetchBilling(`/api/billing/admin/pricing/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export async function deactivateAdminPricing(
  id: string
): Promise<{ ok: true; data: AdminPricing }> {
  return fetchBilling(`/api/billing/admin/pricing/${id}`, { method: "DELETE" })
}

export async function getAdminOrders(params?: {
  page?: number
  limit?: number
  organizationId?: string
  packageCode?: string
  status?: string
  billingPeriod?: string
  from?: string
  to?: string
}): Promise<AdminOrdersResponse> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") query.set(key, String(value))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return fetchBilling<AdminOrdersResponse>(`/api/billing/admin/orders${suffix}`)
}
// ─── Customer Catalog ──────────────────────────────────────────────────

export type CatalogOffer = {
  id: string
  billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
  periodMonths: 1 | 3 | 6 | 12
  periodPrice: string
  currency: string
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  effectiveFrom: string
  effectiveTo: string | null
}

export type CatalogPlan = {
  id: string
  code: string
  name: string
  resources: Record<string, unknown>
  offers: CatalogOffer[]
}

export type CatalogProduct = {
  code: string
  name: string
  description: string | null
  plans: CatalogPlan[]
}

export type CatalogListResponse = {
  products: CatalogProduct[]
  currency: string
}

export type CatalogProductDetailResponse = {
  product: CatalogProduct
  currency: string
}

export async function getCatalog(
  currency?: string
): Promise<CatalogListResponse> {
  const query = currency ? `?currency=${currency}` : ""
  return fetchBilling<CatalogListResponse>(`/api/billing/catalog${query}`)
}

export async function getCatalogProduct(
  code: string,
  currency?: string
): Promise<CatalogProductDetailResponse> {
  const query = currency ? `?currency=${currency}` : ""
  return fetchBilling<CatalogProductDetailResponse>(
    `/api/billing/catalog/${code}${query}`
  )
}
