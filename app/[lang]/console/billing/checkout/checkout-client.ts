"use client"

import { eden } from "@/lib/eden"

export type CheckoutQuote = {
  ok: true
  orderId: string
  status: "CHARGED" | "FULFILLED" | "PENDING"
  subscriptionId: string | null
  invoiceId: string | null
  invoiceLineId: string | null
  subtotal: string
  discount: "0"
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

export type CheckoutResult = CheckoutQuote | CheckoutError

export interface CheckoutInput {
  pricingId: string
  quantity?: number
  idempotencyKey: string
}

export async function submitCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const result = (await eden.api.billing.checkout.post(input as never)) as {
    data?: unknown
    error?: { value?: unknown }
  }

  if (result.data) {
    return result.data as CheckoutResult
  }

  const errorBody = result.error?.value as
    | { error?: string; message?: string }
    | undefined

  return {
    ok: false,
    error: errorBody?.error ?? "UNKNOWN_ERROR",
    message: errorBody?.message ?? "An unexpected error occurred.",
  }
}
