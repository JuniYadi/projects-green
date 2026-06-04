import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { getPlatformRoleForUser } from "@/lib/platform-role"

export const createAdminSettingsRoutes = () =>
  new Elysia({ prefix: "/portal/payments/settings" })
    .get("/", async ({ set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

      return {
        ok: true,
        data: {
          expiryDays: parseInt(process.env.DEFAULT_PAYMENT_EXPIRY_DAYS || "7"),
          autoApproveThreshold: parseInt(process.env.AUTO_APPROVE_THRESHOLD || "0"),
          manualTransferUniqueCodeEnabled: process.env.MANUAL_TRANSFER_UNIQUE_CODE_ENABLED !== "false",
        },
      }
    })
    .put("/", async ({ body, set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Authentication required" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      if (platformRole !== "super_admin") {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Admin access required" }
      }

      const { expiryDays, manualTransferUniqueCodeEnabled } = body as {
        expiryDays?: number
        manualTransferUniqueCodeEnabled?: boolean
      }

      if (expiryDays !== undefined && (expiryDays < 1 || expiryDays > 30)) {
        set.status = 400
        return { ok: false, error: "VALIDATION_ERROR", message: "Expiry days must be 1-30" }
      }

      // TODO: Persist settings to database (Task 13)
      // For now, just acknowledge the request

      return { ok: true, message: "Settings updated" }
    })
