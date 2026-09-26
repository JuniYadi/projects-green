import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { PaymentService } from "../services/payment.service"
import { InvoiceAllocationService } from "../services/invoice-allocation.service"

const paymentService = new PaymentService()
const invoiceAllocationService = new InvoiceAllocationService()

const payWithBalanceSchema = z.object({
  invoiceId: z.string().min(1),
})

const payPartialBalanceSchema = z.object({
  invoiceId: z.string().min(1),
  amountToUse: z.number().positive(),
})

const initiateGatewayPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  paymentMethod: z.string().optional(),
})

export const createInvoicePaymentRoutes = (deps?: {
  paymentService?: PaymentService
  invoiceAllocationService?: InvoiceAllocationService
}) => {
  const paySvc = deps?.paymentService ?? paymentService
  const allocSvc = deps?.invoiceAllocationService ?? invoiceAllocationService

  return (
    new Elysia({ prefix: "/invoice" })
      // POST /payment/invoice/pay-with-balance — Pay invoice using account balance
      .post("/pay-with-balance", async ({ body, set }) => {
        const auth = await withAuth()

        if (!auth.user) {
          set.status = 401
          return {
            ok: false as const,
            error: "UNAUTHORIZED" as const,
            message: "You must be signed in to pay an invoice.",
          }
        }

        if (!auth.organizationId) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "No active organization found.",
          }
        }

        const parsed = payWithBalanceSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid input.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        const { invoiceId } = parsed.data

        try {
          await paySvc.payWithBalance(invoiceId, auth.organizationId)

          return {
            ok: true as const,
            message: "Invoice paid successfully.",
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to process payment."

          if (
            message === "Invoice not found or not open" ||
            message === "Insufficient balance"
          ) {
            set.status = 400
            return {
              ok: false as const,
              error: "PAYMENT_FAILED" as const,
              message,
            }
          }

          if (message === "Billing account not found") {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message,
            }
          }

          console.error("[InvoicePayment] Error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_SERVER_ERROR" as const,
            message,
          }
        }
      })

      // POST /payment/invoice/topup-and-pay — Create gap invoice and auto-deduct after topup
      .post("/topup-and-pay", async ({ body, set }) => {
        const auth = await withAuth()

        if (!auth.user) {
          set.status = 401
          return {
            ok: false as const,
            error: "UNAUTHORIZED" as const,
            message: "You must be signed in.",
          }
        }

        if (!auth.organizationId) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "No active organization found.",
          }
        }

        const parsed = payWithBalanceSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid input.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        const { invoiceId } = parsed.data
        const organizationId = auth.organizationId

        try {
          // Get invoice details
          const invoice = await prisma.billingInvoice.findFirst({
            where: {
              id: invoiceId,
              status: "OPEN",
              billingAccount: { organizationId },
            },
          })

          if (!invoice) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message: "Invoice not found or not open.",
            }
          }

          const invoiceAmount = invoice.totalAmount.toNumber()

          // Get billing account
          const account = await prisma.billingAccount.findUnique({
            where: { organizationId },
          })

          if (!account) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message: "Billing account not found.",
            }
          }

          const currentBalance = account.balance.toNumber()
          const gapAmount = invoiceAmount - currentBalance

          if (gapAmount <= 0) {
            // Already have sufficient balance, just pay directly
            await paySvc.payWithBalance(invoiceId, organizationId)
            return {
              ok: true as const,
              message: "Invoice paid with existing balance.",
              topupRequired: false,
            }
          }

          // Create gap topup invoice
          const topupInvoice = await paySvc.createTopupInvoiceForGap(
            organizationId,
            gapAmount
          )

          return {
            ok: true as const,
            message: "Top-up invoice created. Please complete payment first.",
            topupRequired: true,
            gapAmount,
            topupInvoiceId: topupInvoice.id,
            topupInvoiceNumber: topupInvoice.invoiceNumber,
            totalDue: invoiceAmount,
            currentBalance,
            shortfall: gapAmount,
          }
        } catch (error) {
          console.error("[InvoicePayment] Error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_SERVER_ERROR" as const,
            message:
              error instanceof Error
                ? error.message
                : "Unable to process request.",
          }
        }
      })

      // POST /payment/invoice/pay-partial-balance — Partially pay invoice using account balance
      .post("/pay-partial-balance", async ({ body, set }) => {
        const auth = await withAuth()

        if (!auth.user) {
          set.status = 401
          return {
            ok: false as const,
            error: "UNAUTHORIZED" as const,
            message: "You must be signed in to pay an invoice.",
          }
        }

        if (!auth.organizationId) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "No active organization found.",
          }
        }

        const parsed = payPartialBalanceSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid input.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        const { invoiceId, amountToUse } = parsed.data

        try {
          const result = await allocSvc.payPartialWithBalance({
            invoiceId,
            organizationId: auth.organizationId,
            amountToUse,
          })

          return {
            message:
              result.invoiceStatus === "PAID"
                ? "Invoice paid successfully."
                : "Partial payment applied successfully.",
            ...result,
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to process payment."

          if (
            message === "Invoice not found" ||
            message === "Billing account not found"
          ) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message,
            }
          }

          if (
            message === "Invoice is not open for payment" ||
            message === "Invoice is already fully paid" ||
            message === "Insufficient balance" ||
            message.includes("exceeds remaining due")
          ) {
            set.status = 400
            return {
              ok: false as const,
              error: "PAYMENT_FAILED" as const,
              message,
            }
          }

          console.error("[InvoicePayment] Partial payment error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_SERVER_ERROR" as const,
            message,
          }
        }
      })

      // POST /payment/invoice/initiate-gateway-payment — Initiate gateway payment for remaining due
      .post("/initiate-gateway-payment", async ({ body, set }) => {
        const auth = await withAuth()

        if (!auth.user) {
          set.status = 401
          return {
            ok: false as const,
            error: "UNAUTHORIZED" as const,
            message: "You must be signed in to pay an invoice.",
          }
        }

        if (!auth.organizationId) {
          set.status = 403
          return {
            ok: false as const,
            error: "FORBIDDEN" as const,
            message: "No active organization found.",
          }
        }

        const parsed = initiateGatewayPaymentSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid input.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        const { invoiceId, paymentMethod } = parsed.data

        try {
          const result = await allocSvc.initiateGatewayPayment({
            invoiceId,
            organizationId: auth.organizationId,
            paymentMethod,
          })

          return {
            ...result,
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to initiate payment."

          if (message === "Invoice not found") {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message,
            }
          }

          if (
            message === "Invoice is not open for payment" ||
            message === "Invoice is already fully paid" ||
            message.includes("Gateway is not available")
          ) {
            set.status = 400
            return {
              ok: false as const,
              error: "PAYMENT_FAILED" as const,
              message,
            }
          }

          console.error("[InvoicePayment] Initiate gateway error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_SERVER_ERROR" as const,
            message,
          }
        }
      })
  )
}

export const invoicePaymentRoutes = createInvoicePaymentRoutes()
