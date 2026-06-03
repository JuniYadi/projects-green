// Billing API client types and fetch helpers

export type BillingAccount = {
  ok: true
  tenantId: string
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
  monthlyRateIdr: string
  currentPeriodEnd: string | null
  quotaIn?: number | null
  quotaOut?: number | null
  dailyPerDevice?: number | null
}

export type BillingSubscriptions = {
  ok: true
  subscriptions: SubscriptionItem[]
}

export type InvoiceLineItem = {
  description: string
  quantity: string
  unitPriceIdr: string
  amountIdr: string
}

export type InvoiceListItem = {
  id: string
  invoiceNumber: string
  status: string
  issuedAt: string | null
  dueAt: string | null
  totalAmountIdr: string
  currency: string
  lines: InvoiceLineItem[]
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
  isActive: boolean
  isDefault: boolean
}

export type PaymentMethodsResponse = {
  ok: true
  accounts: PaymentMethod[]
}

async function fetchBilling<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
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
  return fetchBilling<InvoiceDetail>(
    `/api/billing/invoices/${id}`,
    options
  )
}

export async function topup(
  input: TopupInput
): Promise<TopupSuccessResponse> {
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

export async function getAdminMembers(): Promise<{
  ok: true
  members: AdminMember[]
}> {
  return fetchBilling<{ ok: true; members: AdminMember[] }>(
    "/api/billing/admin/members"
  )
}

export async function getAdminMember(
  userId: string
): Promise<AdminMemberDetail> {
  return fetchBilling<AdminMemberDetail>(
    `/api/billing/admin/members/${userId}`
  )
}

export async function getAdminAdjustments(params?: {
  type?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}): Promise<AdjustmentsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set("type", params.type)
  if (params?.startDate) searchParams.set("startDate", params.startDate)
  if (params?.endDate) searchParams.set("endDate", params.endDate)
  if (params?.page !== undefined) searchParams.set("page", String(params.page))
  if (params?.limit !== undefined)
    searchParams.set("limit", String(params.limit))

  const endpoint = searchParams.toString()
    ? `/api/billing/admin/adjustments?${searchParams.toString()}`
    : "/api/billing/admin/adjustments"

  return fetchBilling<AdjustmentsResponse>(endpoint)
}
