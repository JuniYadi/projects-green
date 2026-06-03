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
    status: "DRAFT" | "PAID"
  }>
}

export type SubscriptionBillingResult = {
  subscriptionId: string
  status: "BILLED" | "SKIPPED" | "INSUFFICIENT_BALANCE"
  invoiceId?: string
  totalAmount?: number
  error?: string
}

export type InvoiceStatusTransition =
  | { from: "DRAFT"; to: "ISSUED" }
  | { from: "ISSUED"; to: "PAID" }
  | { from: "ISSUED"; to: "OVERDUE" }
  | { from: "DRAFT" | "ISSUED"; to: "CANCELLED" }

export const GRACE_PERIOD_DAYS = 7
export const OVERDUE_GRACE_DAYS = 14
