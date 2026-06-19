import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { topupSchema } from "./billing.schemas"

const MAX_BALANCE = new Decimal("999999999.99")

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

  return new Elysia().post("/topup", async ({ body, set }) => {
    // Guard: simulated route is not for production use
    if (process.env.NODE_ENV === "production") {
      set.status = 410
      return {
        ok: false as const,
        error: "REAL_TOPUP_REQUIRED" as const,
        message: "Use /api/payments/topup for balance top-up payments.",
      }
    }

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
      // Simulated topup - in Phase 2 this will integrate with real payment gateway
      // Wrap in transaction with max balance check to prevent overflow
      const orgId = auth.organizationId as string

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
              reason: `Topup via ${paymentMethod}${referenceId ? ` (ref: ${referenceId})` : ""}`,
              metadataJson: {
                paymentMethod,
                referenceId,
                phase: "simulated",
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
          message: "Billing account not found.",
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
          message: "Topup would exceed maximum balance.",
        }
      }

      console.error("[BillingTopup] Error:", error)
      return toServerError(set, "Unable to process topup right now.")
    }
  })
}

export const billingTopupRoutes = createBillingTopupRoutes()
