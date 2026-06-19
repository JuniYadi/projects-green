import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
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

type AdminMembersRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; orgRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminMembersRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    // super_admin from AuthPlatformUserRole table bypasses auth.role entirely
    if (actor.platformRole === "super_admin") return true
    // tenant-level admin/owner check requires auth.role to be present
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  },
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view billing members.",
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

async function resolveActor(
  auth: BillingAuthContext,
  getPlatformRole: AdminMembersRouteDeps["getPlatformRole"]
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

export interface MemberBillingSummary {
  userId: string
  email: string | null
  name: string | null
  organizationId: string | null
  organizationName: string | null
  subscriptionCount: number
  activeSubscriptionCount: number
  monthlySpendIdr: string
  balanceIdr: string
}

export interface MemberBillingDetail extends MemberBillingSummary {
  subscriptions: Array<{
    id: string
    status: string
    packageCode: string
    planCode: string
    currentPeriodEnd: string | null
  }>
  recentUsage: Array<{
    period: string
    category: string | null
    amountIdr: string
  }>
}

const listQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
})

export const createAdminMembersRoutes = (
  deps: Partial<AdminMembersRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    // GET /billing/admin/members — List all tenant members with billing data
    .get(
      "/admin/members",
      async ({ query, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        // Check admin access
        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(
            set,
            "Only administrators can view billing members."
          )
        }

        const parsedQuery = listQuerySchema.safeParse(query)
        if (!parsedQuery.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid query parameters.",
          }
        }

        const { orgId } = parsedQuery.data

        if (orgId && actor.platformRole !== "super_admin") {
          return toForbidden(set, "Cannot filter by orgId")
        }

        try {
          // Get all billing accounts with their organizations
          // Super_admin sees all; admins see only their org via billing account
          const billingAccountWhere = orgId
            ? { organizationId: orgId }
            : actor.platformRole !== "super_admin" && auth.organizationId
              ? { organizationId: auth.organizationId }
              : undefined

        const billingAccountsWithOrg = await prisma.billingAccount.findMany({
          where: billingAccountWhere,
        })

        // Get organization IDs
        const organizationIds = billingAccountsWithOrg.map((ba) => ba.organizationId)

        // Get all subscriptions for these organizations
        const subscriptions = await prisma.serviceSubscription.findMany({
          where: {
            organizationId: { in: organizationIds },
          },
          include: {
            package: {
              select: { code: true },
            },
            plan: {
              select: { code: true },
            },
          },
        })

        // Get current month usage ledger
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
        const usageLedger = await prisma.billingUsageLedger.findMany({
          where: {
            organizationId: { in: organizationIds },
            period: currentMonth,
          },
        })

        // Aggregate data by organization
        const membersMap = new Map<string, MemberBillingSummary>()

        for (const billingAccount of billingAccountsWithOrg) {
          const orgId = billingAccount.organizationId
          const orgSubscriptions = subscriptions.filter(
            (s) => s.organizationId === orgId
          )
          const orgUsage = usageLedger.filter(
            (u) => u.organizationId === orgId
          )

          // Calculate monthly spend
          const monthlySpend = orgUsage.reduce(
            (sum, u) => sum + (u.amountIdr?.toNumber() ?? 0),
            0
          )

          // Calculate active subscription count
          const activeSubscriptionCount = orgSubscriptions.filter(
            (s) => s.status === "ACTIVE"
          ).length

          // Build member summary
          const memberEntry: MemberBillingSummary = {
            userId: orgId,
            email: null,
            name: orgId,
            organizationId: orgId,
            organizationName: orgId,
            subscriptionCount: orgSubscriptions.length,
            activeSubscriptionCount,
            monthlySpendIdr: monthlySpend.toFixed(2),
            balanceIdr: billingAccount.balance.toFixed(2),
          }

          // Aggregate by user if needed (for multi-org users)
          const existing = membersMap.get(memberEntry.userId)
          if (existing) {
            existing.subscriptionCount += memberEntry.subscriptionCount
            existing.activeSubscriptionCount += memberEntry.activeSubscriptionCount
            existing.monthlySpendIdr = (
              parseFloat(existing.monthlySpendIdr) + parseFloat(memberEntry.monthlySpendIdr)
            ).toFixed(2)
            existing.balanceIdr = (
              parseFloat(existing.balanceIdr) + parseFloat(memberEntry.balanceIdr)
            ).toFixed(2)
          } else {
            membersMap.set(memberEntry.userId, memberEntry)
          }
        }

        const members = Array.from(membersMap.values())

        return {
          ok: true as const,
          members,
        }
      } catch (error) {
        console.error("[AdminMembers] Error:", error)
        return toServerError(set, "Unable to load billing members.")
      }
    })
    // GET /billing/admin/members/:userId — Individual member billing detail
    .get("/admin/members/:userId", async ({ params, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      // Check admin access
      const actor = await resolveActor(auth, getPlatformRole)
      if (!isAdmin(actor)) {
        return toForbidden(
          set,
          "Only administrators can view member billing details."
        )
      }

      const { userId } = params as { userId: string }
      if (!userId) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "User ID is required.",
        }
      }

      try {
        // Find billing account by organization ID, scoped to caller's org for non-super_admin
        const billingAccountWhere: Prisma.BillingAccountWhereInput =
          actor.platformRole !== "super_admin" && auth.organizationId
            ? { organizationId: auth.organizationId }
            : { organizationId: userId }
        const billingAccount = await prisma.billingAccount.findFirst({
          where: billingAccountWhere,
        })

        if (!billingAccount) {
          return toNotFound(set, "Member not found.")
        }

        const orgId = billingAccount.organizationId

        // Get subscriptions
        const subscriptions = await prisma.serviceSubscription.findMany({
          where: { organizationId: orgId },
          include: {
            package: { select: { code: true } },
            plan: { select: { code: true } },
          },
        })

        // Get current month usage
        const currentMonth = new Date().toISOString().slice(0, 7)
        const usageLedger = await prisma.billingUsageLedger.findMany({
          where: {
            organizationId: orgId,
            period: currentMonth,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })

        // Calculate totals
        const monthlySpend = usageLedger.reduce(
          (sum, u) => sum + (u.amountIdr?.toNumber() ?? 0),
          0
        )

        // Calculate active subscription count
        const activeSubscriptionCount = subscriptions.filter(
          (s) => s.status === "ACTIVE"
        ).length

        const memberDetail: MemberBillingDetail = {
          userId: orgId,
          email: null,
          name: orgId,
          organizationId: orgId,
          organizationName: orgId,
          subscriptionCount: subscriptions.length,
          activeSubscriptionCount,
          monthlySpendIdr: monthlySpend.toFixed(2),
          balanceIdr: billingAccount.balance.toFixed(2),
          subscriptions: subscriptions.map((s) => ({
            id: s.id,
            status: s.status,
            packageCode: s.package.code,
            planCode: s.plan.code,
            currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
          })),
          recentUsage: usageLedger.map((u) => ({
            period: u.period,
            category: u.category,
            amountIdr: u.amountIdr?.toFixed(2) ?? "0.00",
          })),
        }

        return {
          ok: true as const,
          member: memberDetail,
        }
      } catch (error) {
        console.error("[AdminMembers] Detail Error:", error)
        return toServerError(set, "Unable to load member billing details.")
      }
    })
}

export const adminMembersRoutes = createAdminMembersRoutes()