import { Elysia } from "elysia"
import { z } from "zod"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
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

type AdminOrgsRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
}

const defaultDeps: AdminOrgsRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view organization list.",
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

export const createAdminOrgsRoutes = (
  deps: Partial<AdminOrgsRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia().get("/admin/orgs", async ({ query, set }) => {
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
        "Only super administrators can view organization list."
      )
    }

    const parsed = listQuerySchema.safeParse(query)
    if (!parsed.success) {
      set.status = 422
      return {
        ok: false as const,
        error: "VALIDATION_ERROR" as const,
        message: "Invalid query parameters.",
      }
    }

    const { page, limit, search } = parsed.data
    const skip = (page - 1) * limit

    try {
      const accountWhere: Prisma.BillingAccountWhereInput = {
        status: "ACTIVE",
      }
      // Note: search by organizationId (UUID) until org name relation is added to BillingAccount
      if (search) {
        accountWhere.organizationId = {
          contains: search,
          mode: "insensitive",
        }
      }

      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      const [accounts, total] = await Promise.all([
        prisma.billingAccount.findMany({
          where: accountWhere,
          skip,
          take: limit,
          orderBy: { balance: "desc" },
        }),
        prisma.billingAccount.count({ where: accountWhere }),
      ])

      // Query service subscriptions and usage ledgers in bulk
      const orgIds = accounts.map((a) => a.organizationId)

      const [subscriptions, usageLedgers] = await Promise.all([
        prisma.serviceSubscription.findMany({
          where: {
            organizationId: { in: orgIds },
            status: "ACTIVE",
          },
          select: { organizationId: true },
        }),
        prisma.billingUsageLedger.findMany({
          where: {
            organizationId: { in: orgIds },
            period: currentPeriod,
          },
          select: { organizationId: true, amountIdr: true },
        }),
      ])

      // Build lookup maps
      const subCountMap = new Map<string, number>()
      for (const sub of subscriptions) {
        subCountMap.set(
          sub.organizationId,
          (subCountMap.get(sub.organizationId) ?? 0) + 1
        )
      }

      const spendMap = new Map<string, number>()
      for (const ledger of usageLedgers) {
        const current = spendMap.get(ledger.organizationId) ?? 0
        spendMap.set(
          ledger.organizationId,
          current + (ledger.amountIdr?.toNumber() ?? 0)
        )
      }

      const orgs = accounts.map((account) => ({
        orgId: account.organizationId,
        orgName: account.organizationId,
        balance: account.balance.toFixed(2),
        currency: account.currency,
        activeSubscriptions: subCountMap.get(account.organizationId) ?? 0,
        monthlySpend: (spendMap.get(account.organizationId) ?? 0).toFixed(2),
        lastTopUp: null,
      }))

      return {
        ok: true as const,
        orgs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error("[AdminOrgs] Error:", error)
      return toServerError(set, "Unable to load organization list.")
    }
  })
}

export const adminOrgsRoutes = createAdminOrgsRoutes()
