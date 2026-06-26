import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { ConfirmationService } from "../services/confirmation.service"
import { PaymentService } from "../services/payment.service"
import { ReviewConfirmationSchema } from "../types/payment.types"
import { toPaymentConfirmationDTO } from "../dto/payment-confirmation.dto"
import { getPlatformRoleForUser } from "@/lib/platform-role"

const confirmationService = new ConfirmationService()
const paymentService = new PaymentService()

const requireConfirmationAuth = async (set: {
  status?: number | string
}) => {
  const auth = await withAuth()
  if (!auth.user) {
    set.status = 401
    return {
      ok: false as const,
      error: "UNAUTHORIZED" as const,
      message: "Authentication required",
      user: null,
    }
  }
  const platformRole = await getPlatformRoleForUser(auth.user)
  if (platformRole !== "super_admin") {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: "Admin access required",
      user: null,
    }
  }
  return { ok: true as const, user: auth.user }
}

export const createAdminConfirmationRoutes = () =>
  new Elysia({ prefix: "/confirmations" })
    .get("/", async ({ query, set }) => {
      const err = await requireConfirmationAuth(set)
      if (err) return err

      const limit = parseInt(query?.limit || "20")
      const offset = parseInt(query?.offset || "0")

      return (await confirmationService.listPending(limit, offset)).map(
        toPaymentConfirmationDTO
      )
    })

    .get("/:id", async ({ params, set }) => {
      const err = await requireConfirmationAuth(set)
      if (err) return err

      const confirmation = await confirmationService.findById(params.id)
      if (!confirmation) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Confirmation not found",
        }
      }

      return toPaymentConfirmationDTO(confirmation)
    })

    .post("/:id/approve", async ({ params, set }) => {
      const result = await requireConfirmationAuth(set)
      if (!result.ok) return result
      const approved = await confirmationService.approve(params.id, result.user.id)

      // Fire-and-forget: send invoice paid email
      paymentService
        .sendInvoicePaidEmail(
          {
            id: approved.invoiceId,
            invoiceNumber: approved.invoiceNumber,
            totalAmount: { toNumber: () => approved.totalAmount },
            currency: approved.currency,
            status: "paid",
            periodStart: new Date(),
            periodEnd: new Date(),
          },
          approved.organizationId
        )
        .catch((err) =>
          console.error(
            `[Admin] Failed to send paid email for ${approved.invoiceNumber}:`,
            err
          )
        )

      return { message: "Payment approved and balance credited" }
    })

    .post("/:id/reject", async ({ params, body, set }) => {
      const result = await requireConfirmationAuth(set)
      if (!result.ok) return result

      const parseResult = ReviewConfirmationSchema.safeParse(body)
      if (!parseResult.success || parseResult.data.action !== "reject") {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Invalid action",
        }
      }

      await confirmationService.reject(
        params.id,
        result.user.id,
        parseResult.data.reason || ""
      )
      return { message: "Payment rejected" }
    })
