import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"

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

const defaultDeps: AdminStatsRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view platform stats.",
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
        totalBalanceResult,
        activeOrgs,
        lowBalanceOrgs,
        monthlySpendResult,
        openInvoices,
        openTickets,
      ] = await Promise.all([
        prisma.billingAccount.aggregate({
          _sum: { balance: true },
          where: { status: "ACTIVE" },
        }),
        prisma.billingAccount.count({
          where: { status: "ACTIVE" },
        }),
        prisma.billingAccount.count({
          where: {
            status: "ACTIVE",
            balance: { lt: new Prisma.Decimal(10000) },
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

      return {
        ok: true as const,
        totalBalance: totalBalanceResult._sum.balance?.toFixed(2) ?? "0.00",
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
