/**
 * Billing Cycle — Shared types for monthly billing orchestration
 */

export type BillingRunResult = {
  billingRunId: string
  processed: number
  skipped: number
  invoices: Array<{
    invoiceId: string
    subscriptionId: string
    totalAmount: number
    status: "OPEN" | "PAID"
  }>
}

export type SubscriptionBillingResult = {
  subscriptionId: string
  status: "BILLED" | "SKIPPED" | "INSUFFICIENT_BALANCE"
  invoiceId?: string
  totalAmount?: number
  error?: string
}

export const GRACE_PERIOD_DAYS = 7
