"use client"

import { eden } from "@/lib/eden"

export type CheckoutAddonOption = {
  id: string
  code: string
  name: string
  description: string | null
  price: string
  currency: string
  billingPeriod: string
  required: boolean
  selected: boolean
}

export type CheckoutVoucher = {
  code: string
  discountType: "PERCENTAGE" | "FIXED"
  sourceAmount: string
  sourceCurrency: string
  discountAmount: string
  discountCurrency: string
  currencyPolicy: string
  exchangeRate: string | null
  rateAt: string | null
  quoteExpiresAt: string
}

export type CheckoutPreview = {
  ok: true
  quoteId: string
  quoteToken: string
  pricingId: string
  packageCode: string
  planCode: string
  billingStrategy?: "PRO_RATA" | "FIXED_CYCLE"
  resources?: Record<string, unknown>
  currency: string
  billingPeriod: string
  quantity: string
  periodStart: string
  periodEnd: string
  isProrated?: boolean
  proratedDays?: number
  totalDaysInPeriod?: number
  subtotal: string
  discount: string
  firstPayment: string
  nextRenewal: string
  addons: CheckoutAddonOption[]
  availableAddons?: CheckoutAddonOption[]
  voucher: CheckoutVoucher | null
  expiresAt: string
}

export type CheckoutSuccess = {
  ok: true
  orderId: string
  status: "CHARGED" | "FULFILLED" | "PENDING"
  subscriptionId: string | null
  invoiceId: string | null
  invoiceLineId: string | null
  subtotal: string
  discount: string
  firstPayment: string
  nextRenewal: string | null
  currency: string
  billingPeriod: string
  periodStart: string
  periodEnd: string
}

export type CheckoutError = {
  ok: false
  error: string
  message: string
}

export type CheckoutResult = CheckoutSuccess | CheckoutError

export interface CheckoutDeviceInput {
  phoneNumber: string
  displayName?: string
  profilePictureUrl?: string
}

export interface CheckoutInput {
  pricingId: string
  quantity?: number
  addonIds?: string[]
  voucherCode?: string
  quoteToken?: string
  mode?: "PURCHASE" | "UPGRADE" | "CHANGE_TERM"
  subscriptionId?: string
  idempotencyKey: string
  device?: CheckoutDeviceInput
  metadata?: Record<string, unknown>
}
type BillingCheckoutApi = {
  quote: {
    post(input: CheckoutInput): Promise<{
      data?: unknown
      error?: { value?: unknown }
    }>
  }
}

function readError(result: { error?: { value?: unknown } }): CheckoutError {
  const errorBody = result.error?.value as
    | { error?: string; message?: string }
    | undefined
  return {
    ok: false,
    error: errorBody?.error ?? "UNKNOWN_ERROR",
    message: errorBody?.message ?? "An unexpected error occurred.",
  }
}

export async function getCheckoutQuote(
  input: CheckoutInput
): Promise<CheckoutPreview | CheckoutError> {
  const checkoutApi = eden.api.billing.checkout as unknown as BillingCheckoutApi
  const result = await checkoutApi.quote.post(input)
  return result.data
    ? ({
        ok: true,
        ...(result.data as Omit<CheckoutPreview, "ok">),
      } as CheckoutPreview)
    : readError(result)
}

export async function submitCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const result = (await eden.api.billing.checkout.post(input as never)) as {
    data?: unknown
    error?: { value?: unknown }
  }

  return result.data ? (result.data as CheckoutResult) : readError(result)
}
