import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { ConfirmationService } from "../services/confirmation.service"
import { ConfirmPaymentSchema } from "../types/payment.types"

const confirmationService = new ConfirmationService()

export const createConfirmRoutes = () =>
  new Elysia({ prefix: "/topup/confirm" })
    .post("/:id", async ({ params, body, set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Organization required" }
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

      const { bankAccountId, amount, paymentDateTime, senderBankName, senderName, senderAccount, screenshotUrl, notes } = parseResult.data

      // Get tenantId from session or use organizationId
      const tenantId = (auth as unknown as Record<string, string>).tenantId || auth.organizationId

      try {
        const confirmation = await confirmationService.create({
          invoiceId: params.id,
          tenantId,
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
        set.status = 400
        return {
          ok: false,
          error: "CREATE_FAILED",
          message: error instanceof Error ? error.message : "Failed to create confirmation",
        }
      }
    })
