import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { PaymentService } from "../services/payment.service"

const paymentService = new PaymentService()

const payWithBalanceSchema = z.object({
  invoiceId: z.string().min(1),
})

export const createInvoicePaymentRoutes = () =>
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
      const tenantId = auth.organizationId

      try {
        await paymentService.payWithBalance(invoiceId, tenantId)

        return {
          ok: true as const,
          message: "Invoice paid successfully.",
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to process payment."

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
      const tenantId = auth.organizationId

      try {
        // Get invoice details
        const invoice = await prisma.invoice.findFirst({
          where: { id: invoiceId, status: "OPEN" },
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
          where: { tenantId },
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
          await paymentService.payWithBalance(invoiceId, tenantId)
          return {
            ok: true as const,
            message: "Invoice paid with existing balance.",
            topupRequired: false,
          }
        }

        // Create gap topup invoice
        const topupInvoice = await paymentService.createTopupInvoiceForGap(
          tenantId,
          auth.organizationId,
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
            error instanceof Error ? error.message : "Unable to process request.",
        }
      }
    })

export const invoicePaymentRoutes = createInvoicePaymentRoutes()
