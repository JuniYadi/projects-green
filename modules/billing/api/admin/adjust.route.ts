import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { adminAdjustSchema } from "../billing.schemas"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminAdjustRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; tenantRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminAdjustRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) =>
    actor.platformRole === "super_admin" ||
    actor.tenantRole === "admin" ||
    actor.tenantRole === "owner",
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to adjust billing.",
  }
}

const toForbidden = (set: RouteSet, message: string) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    message,
  }
}

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

async function resolveActor(
  auth: BillingAuthContext,
  getPlatformRole: AdminAdjustRouteDeps["getPlatformRole"]
) {
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    platformRole,
    tenantRole: auth.role,
  }
}

export const createAdminBillingRoutes = (
  deps: Partial<AdminAdjustRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    // POST /billing/admin/adjust — Manual balance adjustment
    .post("/admin/adjust", async ({ body, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      // Parse and validate body
      const parsed = adminAdjustSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { tenantId, type, amount, reason } = parsed.data

      // Check admin access
      const actor = await resolveActor(auth, getPlatformRole)
      if (!isAdmin(actor)) {
        return toForbidden(
          set,
          "Only administrators can perform balance adjustments."
        )
      }

      try {
        // Find billing account for tenant
        const account = await prisma.billingAccount.findUnique({
          where: { tenantId },
        })

        if (!account) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Billing account not found for the specified tenant.",
          }
        }

        // Perform adjustment
        const balanceBefore = account.balance
        const balanceAfter =
          type === "CREDIT"
            ? balanceBefore.plus(amount)
            : balanceBefore.minus(amount)

        if (balanceAfter.lt(0)) {
          set.status = 400
          return {
            ok: false as const,
            error: "INVALID_ADJUSTMENT" as const,
            message: "Adjustment would result in negative balance.",
          }
        }

        const [updatedAccount, adjustment] = await prisma.$transaction([
          prisma.billingAccount.update({
            where: { id: account.id },
            data: { balance: balanceAfter },
          }),
          prisma.billingAdjustment.create({
            data: {
              billingAccountId: account.id,
              adjustmentType: type,
              amount,
              currency: "IDR",
              reason,
              metadataJson: {
                performedBy: auth.user.id,
                actorRole: actor.platformRole === "super_admin" ? "super_admin" : actor.tenantRole,
              },
            },
          }),
        ])

        return {
          ok: true as const,
          adjustmentId: adjustment.id,
          newBalanceIdr: updatedAccount.balance.toFixed(2),
          type,
          amountIdr: amount.toString(),
        }
      } catch (error) {
        console.error("[AdminAdjust] Error:", error)
        return toServerError(set, "Unable to perform balance adjustment.")
      }
    })
}

export const adminBillingRoutes = createAdminBillingRoutes()