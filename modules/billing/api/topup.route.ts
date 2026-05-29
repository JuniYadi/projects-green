import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { topupSchema } from "./billing.schemas"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type BillingTopupRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
}

const defaultDeps: BillingTopupRouteDeps = {
  authenticate: () => withAuth(),
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to top up balance.",
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

export const createBillingTopupRoutes = (
  deps: Partial<BillingTopupRouteDeps> = {}
) => {
  const { authenticate } = { ...defaultDeps, ...deps }

  return new Elysia()
    .post("/topup", async ({ body, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for billing.")
      }

      const parsed = topupSchema.safeParse(body)

      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { amount, paymentMethod, referenceId } = parsed.data

      try {
        // Get tenantId from BillingAccount by organizationId
        const account = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
        })

        if (!account) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Billing account not found.",
          }
        }

        // Simulated topup - in Phase 2 this will integrate with real payment gateway
        // For now, we immediately credit the account
        const [updatedAccount, adjustment] = await prisma.$transaction([
          prisma.billingAccount.update({
            where: { id: account.id },
            data: {
              balance: { increment: amount },
            },
          }),
          prisma.billingAdjustment.create({
            data: {
              billingAccountId: account.id,
              adjustmentType: "CREDIT",
              amount,
              currency: "IDR",
              reason: `Topup via ${paymentMethod}${referenceId ? ` (ref: ${referenceId})` : ""}`,
              metadataJson: {
                paymentMethod,
                referenceId,
                phase: "simulated",
              },
            },
          }),
        ])

        return {
          ok: true as const,
          adjustmentId: adjustment.id,
          newBalanceIdr: updatedAccount.balance.toFixed(2),
          amountIdr: amount.toString(),
          type: "CREDIT" as const,
        }
      } catch (error) {
        console.error("[BillingTopup] Error:", error)
        return toServerError(set, "Unable to process topup right now.")
      }
    })
}

export const billingTopupRoutes = createBillingTopupRoutes()