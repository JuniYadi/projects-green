import { Elysia } from "elysia"
import { z } from "zod"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"

const MAX_BALANCE = new Decimal("999999999.99")

const adminTopupSchema = z.object({
  orgId: z.string().uuid(),
  amount: z.number().int().min(1),
  reason: z.string().min(1).max(500).default("Admin topup"),
})

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminTopupRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
}

const defaultDeps: AdminTopupRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to perform admin topup.",
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

// SECURITY NOTE: Rate limiting is intentionally omitted here because:
// 1. This endpoint is restricted to super_admin role only (enforced by WorkOS)
// 2. The $ transaction + MAX_BALANCE cap prevents runaway balance inflation
// 3. All topups create an immutable BillingAdjustment audit trail
// If rate limiting is needed in the future, use a per-user sliding window
// (e.g., Upstash Ratelimit) — not in-memory, to work across serverless instances.
export const createAdminTopupRoutes = (
  deps: Partial<AdminTopupRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia().post("/admin/topup", async ({ body, set }) => {
    const auth = await authenticate()

    if (!auth.user) {
      return toUnauthorized(set)
    }

    const platformRole = await getPlatformRole({
      id: auth.user.id,
      email: auth.user.email,
    })

    if (platformRole !== "super_admin") {
      return toForbidden(
        set,
        "Only super administrators can perform admin topup."
      )
    }

    const parsed = adminTopupSchema.safeParse(body)

    if (!parsed.success) {
      set.status = 422
      return {
        ok: false as const,
        error: "VALIDATION_ERROR" as const,
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
      }
    }

    const { orgId, amount, reason } = parsed.data
    const actingUserId = auth.user.id

    try {
      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.billingAccount.findUnique({
          where: { organizationId: orgId },
        })

        if (!account) {
          throw new Error("NOT_FOUND")
        }

        const balanceAfter = account.balance.plus(amount)

        if (balanceAfter.gt(MAX_BALANCE)) {
          throw new Error("BALANCE_LIMIT_EXCEEDED")
        }

        const userId = actingUserId

        const [updatedAccount, adjustment] = await Promise.all([
          tx.billingAccount.update({
            where: { id: account.id },
            data: { balance: balanceAfter },
          }),
          tx.billingAdjustment.create({
            data: {
              billingAccountId: account.id,
              adjustmentType: "CREDIT",
              amount,
              currency: "IDR",
              reason,
              createdByWorkosUserId: userId,
              metadataJson: {
                performedBy: userId,
                actorRole: "super_admin",
              },
            },
          }),
        ])

        return { updatedAccount, adjustment }
      })

      return {
        ok: true as const,
        adjustmentId: result.adjustment.id,
        newBalanceIdr: result.updatedAccount.balance.toFixed(2),
        amountIdr: amount.toString(),
        type: "CREDIT" as const,
      }
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Billing account not found for the specified organization.",
        }
      }

      if (
        error instanceof Error &&
        error.message === "BALANCE_LIMIT_EXCEEDED"
      ) {
        set.status = 400
        return {
          ok: false as const,
          error: "BALANCE_LIMIT_EXCEEDED" as const,
          message: "Adding this amount would exceed the maximum balance.",
        }
      }

      console.error("[AdminTopup] Error:", error)
      return toServerError(set, "Unable to process admin topup.")
    }
  })
}

export const adminTopupRoutes = createAdminTopupRoutes()
