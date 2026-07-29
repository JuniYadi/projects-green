import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { MINIMUM_BALANCE_WARN_IDR } from "@/modules/billing/constants"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminStatsRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
}
const MINIMUM_BALANCE_WARN_BY_CURRENCY: Record<string, number> = {
  IDR: MINIMUM_BALANCE_WARN_IDR,
  USD: 5,
}

const defaultDeps: AdminStatsRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED",
  }
}

const toForbidden = (set: RouteSet, message: string) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN",
    message,
  }
}

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR",
    message,
  }
}

const BALANCE_CURRENCIES = ["IDR", "USD"] as const
type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number]
const emptyTotalBalances = (): Record<BalanceCurrency, string> => ({
  IDR: "0.00",
  USD: "0.00",
})
export const createAdminStatsRoutes = (
  deps: Partial<AdminStatsRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia().get("/admin/stats", async ({ set }) => {
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
        "Only super administrators can view platform stats."
      )
    }

    try {
      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      const [
        totalBalanceRows,
        activeOrgs,
        lowBalanceOrgs,
        monthlySpendResult,
        openInvoices,
        openTickets,
      ] = await Promise.all([
        prisma.billingAccount.groupBy({
          by: ["currency"],
          where: {
            status: "ACTIVE",
            currency: { in: BALANCE_CURRENCIES as unknown as string[] },
          },
          _sum: { balance: true },
        }),
        prisma.billingAccount.count({
          where: { status: "ACTIVE" },
        }),
        prisma.billingAccount.count({
          where: {
            status: "ACTIVE",
            OR: Object.entries(MINIMUM_BALANCE_WARN_BY_CURRENCY).map(
              ([currency, threshold]) => ({
                currency,
                balance: { lt: new Prisma.Decimal(threshold) },
              })
            ),
          },
        }),
        prisma.billingUsageLedger.aggregate({
          _sum: { amountIdr: true },
          where: { period: currentPeriod },
        }),
        prisma.billingInvoice.count({
          where: { status: "OPEN" },
        }),
        prisma.supportTicket.count({
          where: { status: "OPEN" },
        }),
      ])

      const totalBalances = emptyTotalBalances()
      for (const row of totalBalanceRows) {
        if (row.currency in totalBalances) {
          totalBalances[row.currency as BalanceCurrency] =
            row._sum.balance?.toFixed(2) ?? "0.00"
        }
      }

      return {
        ok: true as const,
        totalBalances,
        activeOrgs,
        totalSpend: monthlySpendResult._sum.amountIdr?.toFixed(2) ?? "0.00",
        lowBalanceOrgs,
        openInvoices,
        openTickets,
      }
    } catch (error) {
      console.error("[AdminStats] Error:", error)
      return toServerError(set, "Unable to load platform stats.")
    }
  })
}

export const adminStatsRoutes = createAdminStatsRoutes()
