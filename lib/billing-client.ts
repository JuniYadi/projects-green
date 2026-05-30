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

export type ApiErrorResponse = {
  ok: false
  error: string
  message: string
  fieldErrors?: Record<string, string[]>
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

export async function getAccount(): Promise<BillingAccount> {
  return fetchBilling<BillingAccount>("/api/billing/account")
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

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  return fetchBilling<InvoiceDetail>(`/api/billing/invoices/${id}`)
}

export async function topup(
  input: TopupInput
): Promise<TopupSuccessResponse> {
  return fetchBilling<TopupSuccessResponse>("/api/billing/topup", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
