import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { ConfirmationService } from "../services/confirmation.service"
import { ConfirmPaymentSchema } from "../types/payment.types"

const confirmationService = new ConfirmationService()

export const createConfirmRoutes = () =>
  new Elysia({ prefix: "/topup/confirm" }).post(
    "/:id",
    async ({ params, body, set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Organization required",
        }
      }

      const parseResult = ConfirmPaymentSchema.safeParse(body)
      if (!parseResult.success) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid input",
          fieldErrors: parseResult.error.flatten().fieldErrors,
        }
      }

      const {
        bankAccountId,
        amount,
        paymentDateTime,
        senderBankName,
        senderName,
        senderAccount,
        screenshotUrl,
        notes,
      } = parseResult.data

      // Look up invoice to determine correct organizationId
      const invoice = await prisma.billingInvoice.findFirst({
        where: { id: params.id, status: "OPEN", billingAccount: { organizationId: auth.organizationId } },
      })

      if (!invoice) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Invoice not found or not open",
        }
      }

      try {
        const confirmation = await confirmationService.create({
          invoiceId: params.id,
          organizationId: auth.organizationId,
          data: {
            bankAccountId,
            amount,
            paymentDateTime: new Date(paymentDateTime),
            senderBankName,
            senderName,
            senderAccount,
            screenshotUrl,
            notes,
          },
        })

        return {
          ok: true,
          confirmation: {
            id: confirmation.id,
            status: confirmation.status,
            createdAt: confirmation.createdAt.toISOString(),
          },
        }
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : "Failed to create confirmation"
        if (msg === "CONFIRMATION_ALREADY_EXISTS_PENDING") {
          set.status = 409
          return {
            ok: false,
            error: "DUPLICATE_CONFIRMATION",
            message:
              "A pending payment confirmation already exists for this invoice.",
          }
        }
        if (msg === "CONFIRMATION_INVOICE_ALREADY_PAID") {
          set.status = 409
          return {
            ok: false,
            error: "INVOICE_ALREADY_PAID",
            message: "This invoice has already been paid.",
          }
        }
        set.status = 400
        return {
          ok: false,
          error: "CREATE_FAILED",
          message: msg,
        }
      }
    }
  )
