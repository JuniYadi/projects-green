import { Elysia } from "elysia"
import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs"
import type { Organization } from "@workos-inc/node"
import { Prisma } from "@prisma/client"

import { MINIMUM_BALANCE_WARN_IDR } from "../constants"
import { ensureBillingAccountForOrg } from "../billing-account.service"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type BillingAccountRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  ensureBillingAccountForOrg: typeof ensureBillingAccountForOrg
  getOrganizationAction: (orgId: string) => Promise<Organization>
}

type RouteSet = {
  status?: number | string
}

const defaultDeps: BillingAccountRouteDeps = {
  authenticate: () => withAuth(),
  ensureBillingAccountForOrg,
  getOrganizationAction: async (orgId: string) =>
    getWorkOS().organizations.getOrganization(orgId),
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

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

function formatBalance(amount: Prisma.Decimal, currency: string): string {
  const num = Number(amount)
  const locale = currency === "USD" ? "en-US" : "id-ID"
  return `${currency} ${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const { authenticate, ensureBillingAccountForOrg, getOrganizationAction } = {
    ...defaultDeps,
    ...deps,
  }

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
        // JIT upsert: find or create BillingAccount for org
        const account = await ensureBillingAccountForOrg({
          organizationId: auth.organizationId,
          getOrganizationAction,
        })

        const balance = account.balance
        const currency = account.preferredCurrency
        const isPositive = balance.gt(0)
        const isAboveWarn = balance.gte(MINIMUM_BALANCE_WARN_IDR)
        const accountAge = daysSince(account.createdAt)

        return {
          ok: true as const,
          organizationId: account.organizationId,
          currency,
          balanceIdr: balance.toFixed(2),
          formattedBalance: formatBalance(balance, currency),
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