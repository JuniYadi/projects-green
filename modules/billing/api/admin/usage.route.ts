import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
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

type AdminUsageRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
  isAdmin: (actor: {
    platformRole: PlatformAccessRole
    orgRole: string | null | undefined
  }) => boolean
}

const defaultDeps: AdminUsageRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  },
}

const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  orgId: z.string().uuid().optional(),
})

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view usage data.",
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
  getPlatformRole: AdminUsageRouteDeps["getPlatformRole"]
) {
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    platformRole,
    orgRole: auth.role,
  }
}

export const createAdminUsageRoutes = (
  deps: Partial<AdminUsageRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia().get("/admin/usage", async ({ query, set }) => {
    const auth = await authenticate()

    if (!auth.user) {
      return toUnauthorized(set)
    }

    const actor = await resolveActor(auth, getPlatformRole)
    if (!isAdmin(actor)) {
      return toForbidden(
        set,
        "Only administrators can view platform usage data."
      )
    }

    const parsed = querySchema.safeParse(query)
    if (!parsed.success) {
      set.status = 422
      return {
        ok: false as const,
        error: "VALIDATION_ERROR" as const,
        message: "Invalid query parameters.",
      }
    }

    const { days, orgId } = parsed.data

    if (orgId && actor.platformRole !== "super_admin") {
      return toForbidden(set, "Cannot filter by orgId")
    }

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const orgFilter: Prisma.BillingUsageLedgerWhereInput = orgId
        ? { organizationId: orgId }
        : actor.platformRole !== "super_admin" && auth.organizationId
          ? { organizationId: auth.organizationId }
          : {}

      const dateFilter: Prisma.BillingUsageLedgerWhereInput = {
        ...orgFilter,
        createdAt: { gte: startDate },
      }

      const [allEntries, groupedByCategory] = await Promise.all([
        prisma.billingUsageLedger.findMany({
          where: dateFilter,
          select: {
            category: true,
            amountIdr: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.billingUsageLedger.groupBy({
          by: ["category"],
          where: dateFilter,
          _sum: { amountIdr: true },
          _count: true,
          orderBy: { _sum: { amountIdr: "desc" } },
        }),
      ])

      // ── Build breakdown ──────────────────────────────
      const totalSpend = groupedByCategory.reduce(
        (sum, row) => sum + Number(row._sum.amountIdr ?? 0),
        0
      )

      const breakdown = groupedByCategory.map((row) => {
        const categoryTotal = Number(row._sum.amountIdr ?? 0)
        return {
          category: row.category ?? "unknown",
          quantity: row._count,
          totalCost: categoryTotal,
          percentage: totalSpend > 0 ? (categoryTotal / totalSpend) * 100 : 0,
        }
      })

      // ── Build daily trend ────────────────────────────
      const dailyMap = new Map<string, number>()

      for (const entry of allEntries) {
        const dateStr = entry.createdAt.toISOString().split("T")[0]
        const existing = dailyMap.get(dateStr) ?? 0
        dailyMap.set(dateStr, existing + Number(entry.amountIdr ?? 0))
      }

      const trend = Array.from(dailyMap.entries()).map(([date, amount]) => ({
        date,
        amount,
      }))

      return {
        ok: true as const,
        data: {
          breakdown,
          trend,
        },
      }
    } catch (error) {
      console.error("[AdminUsage] Error:", error)
      return toServerError(set, "Unable to load usage data.")
    }
  })
}

export const adminUsageRoutes = createAdminUsageRoutes()
