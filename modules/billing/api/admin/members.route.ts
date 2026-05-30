import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

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

type AdminMembersRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; tenantRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminMembersRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) =>
    actor.platformRole === "super_admin" ||
    actor.tenantRole === "admin" ||
    actor.tenantRole === "owner",
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
    tenantRole: auth.role,
  }
}

export interface MemberBillingSummary {
  userId: string
  email: string | null
  name: string | null
  tenantId: string | null
  tenantName: string | null
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

export const createAdminMembersRoutes = (
  deps: Partial<AdminMembersRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    // GET /billing/admin/members — List all tenant members with billing data
    .get("/admin/members", async ({ set }) => {
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

      try {
        // Get all tenants with their billing accounts
        // Super_admin sees all; admins see only their org via billing account
        const tenantWhere = actor.platformRole !== "super_admin" && auth.organizationId
          ? { billingAccounts: { some: { organizationId: auth.organizationId } } }
          : undefined

        const tenantsWithBilling = await prisma.tenant.findMany({
          where: tenantWhere,
          include: {
            billingAccounts: {
              select: {
                id: true,
                balance: true,
              },
            },
          },
        })

        // Get all subscriptions for these tenants
        const tenantIds = tenantsWithBilling.map((t) => t.id)
        const subscriptions = await prisma.subscription.findMany({
          where: {
            tenantId: { in: tenantIds },
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
        const usageLedger = await prisma.usageLedger.findMany({
          where: {
            tenantId: { in: tenantIds },
            period: currentMonth,
          },
        })

        // Aggregate data by user (workos user id from tenant relation)
        // Since we don't have direct user mapping, we aggregate by tenant
        const membersMap = new Map<string, MemberBillingSummary>()

        for (const tenant of tenantsWithBilling) {
          const tenantSubscriptions = subscriptions.filter(
            (s) => s.tenantId === tenant.id
          )
          const tenantUsage = usageLedger.filter(
            (u) => u.tenantId === tenant.id
          )

          // Calculate monthly spend
          const monthlySpend = tenantUsage.reduce(
            (sum, u) => sum + (u.amountIdr?.toNumber() ?? 0),
            0
          )

          // Get user info from subscriptions (assuming each tenant has one user context)
          // In real implementation, this would come from WorkOS organization memberships
          const firstSubscription = tenantSubscriptions[0]

          // Calculate active subscription count
          const activeSubscriptionCount = tenantSubscriptions.filter(
            (s) => s.status === "ACTIVE"
          ).length

          // Build member summary
          const memberEntry: MemberBillingSummary = {
            userId: tenant.id, // Using tenant id as proxy - in real impl would be workos user id
            email: null, // Would come from WorkOS
            name: tenant.name,
            tenantId: tenant.id,
            tenantName: tenant.name,
            subscriptionCount: tenantSubscriptions.length,
            activeSubscriptionCount,
            monthlySpendIdr: monthlySpend.toFixed(2),
            balanceIdr: tenant.billingAccounts[0]?.balance.toFixed(2) ?? "0.00",
          }

          // Aggregate by user if needed (for multi-tenant users)
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
        // Find tenant by the given userId (or tenant id as proxy)
        const tenant = await prisma.tenant.findFirst({
          where: {
            OR: [{ id: userId }, { code: userId }],
          },
          include: {
            billingAccounts: {
              select: {
                id: true,
                balance: true,
              },
            },
          },
        })

        // If no tenant found by id, search by subscription user context
        // This is a placeholder - in real impl would query WorkOS for user memberships
        if (!tenant) {
          return toNotFound(set, "Member not found.")
        }

        // Get subscriptions
        const subscriptions = await prisma.subscription.findMany({
          where: { tenantId: tenant.id },
          include: {
            package: { select: { code: true } },
            plan: { select: { code: true } },
          },
        })

        // Get current month usage
        const currentMonth = new Date().toISOString().slice(0, 7)
        const usageLedger = await prisma.usageLedger.findMany({
          where: {
            tenantId: tenant.id,
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
          userId: tenant.id,
          email: null, // Would come from WorkOS
          name: tenant.name,
          tenantId: tenant.id,
          tenantName: tenant.name,
          subscriptionCount: subscriptions.length,
          activeSubscriptionCount,
          monthlySpendIdr: monthlySpend.toFixed(2),
          balanceIdr: tenant.billingAccounts[0]?.balance.toFixed(2) ?? "0.00",
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