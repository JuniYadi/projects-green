import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { ConfirmationService } from "../services/confirmation.service"
import { ReviewConfirmationSchema } from "../types/payment.types"
import { toPaymentConfirmationDTO } from "../dto/payment-confirmation.dto"
import { getPlatformRoleForUser } from "@/lib/platform-role"

const confirmationService = new ConfirmationService()

export const createAdminConfirmationRoutes = () =>
  new Elysia({ prefix: "/confirmations" })
    .get("/", async ({ query }) => {
      const auth = await withAuth()
      if (!auth.user) {
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Authentication required",
        }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin access required",
        }
      }

      const limit = parseInt(query?.limit || "20")
      const offset = parseInt(query?.offset || "0")

      const confirmations = await confirmationService.listPending(limit, offset)
      return { ok: true, data: confirmations.map(toPaymentConfirmationDTO) }
    })

    .get("/:id", async ({ params }) => {
      const auth = await withAuth()
      if (!auth.user) {
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Authentication required",
        }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin access required",
        }
      }

      const confirmation = await confirmationService.findById(params.id)
      if (!confirmation) {
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Confirmation not found",
        }
      }

      return { ok: true, data: toPaymentConfirmationDTO(confirmation) }
    })

    .post("/:id/approve", async ({ params }) => {
      const auth = await withAuth()
      if (!auth.user) {
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Authentication required",
        }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin access required",
        }
      }

      await confirmationService.approve(params.id, auth.user.id)
      return { ok: true, message: "Payment approved and balance credited" }
    })

    .post("/:id/reject", async ({ params, body }) => {
      const auth = await withAuth()
      if (!auth.user) {
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Authentication required",
        }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin access required",
        }
      }

      const parseResult = ReviewConfirmationSchema.safeParse(body)
      if (!parseResult.success || parseResult.data.action !== "reject") {
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid action",
        }
      }

      await confirmationService.reject(
        params.id,
        auth.user.id,
        parseResult.data.reason || ""
      )
      return { ok: true, message: "Payment rejected" }
    })
