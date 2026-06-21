import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { ConfirmationService } from "../services/confirmation.service"
import { ReviewConfirmationSchema } from "../types/payment.types"
import { toPaymentConfirmationDTO } from "../dto/payment-confirmation.dto"
import { getPlatformRoleForUser } from "@/lib/platform-role"

const confirmationService = new ConfirmationService()

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
    }
  }
  const platformRole = await getPlatformRoleForUser(auth.user)
  if (platformRole !== "super_admin") {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: "Admin access required",
    }
  }
  return null
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
      const err = await requireConfirmationAuth(set)
      if (err) return err

      await confirmationService.approve(params.id, (await withAuth()).user!.id)
      return { message: "Payment approved and balance credited" }
    })

    .post("/:id/reject", async ({ params, body, set }) => {
      const err = await requireConfirmationAuth(set)
      if (err) return err

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
        (await withAuth()).user!.id,
        parseResult.data.reason || ""
      )
      return { message: "Payment rejected" }
    })
