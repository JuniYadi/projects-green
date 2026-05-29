import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { MINIMUM_BALANCE_WARN_IDR } from "../constants"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type BillingAccountRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
}

const defaultDeps: BillingAccountRouteDeps = {
  authenticate: () => withAuth(),
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to access billing.",
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

const toNotFound = (set: RouteSet, message: string) => {
  set.status = 404
  return {
    ok: false as const,
    error: "NOT_FOUND" as const,
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

function formatBalanceIdr(amount: Prisma.Decimal): string {
  const num = Number(amount)
  return `IDR ${num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function daysSince(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "1 day"
  return `${diffDays} days`
}

export const createBillingAccountRoutes = (
  deps: Partial<BillingAccountRouteDeps> = {}
) => {
  const { authenticate } = { ...defaultDeps, ...deps }

  return new Elysia()
    .get("/account", async ({ set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for billing.")
      }

      try {
        // Get tenantId from BillingAccount by organizationId
        const account = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
        })

        if (!account) {
          return toNotFound(set, "Billing account not found.")
        }

        const balance = account.balance
        const isPositive = balance.gt(0)
        const isAboveWarn = balance.gte(MINIMUM_BALANCE_WARN_IDR)
        const accountAge = daysSince(account.createdAt)

        return {
          ok: true as const,
          balanceIdr: balance.toFixed(2),
          formattedBalance: formatBalanceIdr(balance),
          isAboveWarn,
          isPositive,
          accountAge,
        }
      } catch (error) {
        console.error("[BillingAccount] Error:", error)
        return toServerError(set, "Unable to load billing account right now.")
      }
    })
}

export const billingAccountRoutes = createBillingAccountRoutes()