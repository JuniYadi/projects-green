import { Elysia } from "elysia"
import { z } from "zod"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { getCachedOrganization } from "@/lib/workos-directory"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminOrgDetailRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
}

const defaultDeps: AdminOrgDetailRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view organization details.",
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

export const createAdminOrgDetailRoutes = (
  deps: Partial<AdminOrgDetailRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia().get("/admin/orgs/:orgId", async ({ params, set }) => {
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
        "Only super administrators can view organization details."
      )
    }

    const orgIdResult = z.string().min(1).safeParse(params.orgId)
    if (!orgIdResult.success) {
      set.status = 422
      return {
        ok: false as const,
        error: "VALIDATION_ERROR" as const,
        message: "Invalid organization ID.",
      }
    }

    const orgId = orgIdResult.data

    try {
      const account = await prisma.billingAccount.findUnique({
        where: { organizationId: orgId },
      })

      if (!account) {
        return toNotFound(set, "Billing account not found.")
      }

      const cachedOrg = await getCachedOrganization(orgId)

      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      const [subscriptions, contacts, monthlySpendResult, recentInvoices] =
        await Promise.all([
          prisma.serviceSubscription.findMany({
            where: { organizationId: orgId, status: "ACTIVE" },
            include: {
              package: { select: { code: true } },
              plan: { select: { code: true } },
            },
          }),
          prisma.billingContact.findMany({
            where: { billingAccountId: account.id, isActive: true },
          }),
          prisma.billingUsageLedger.aggregate({
            _sum: { amountIdr: true },
            where: {
              organizationId: orgId,
              period: currentPeriod,
            },
          }),
          prisma.billingInvoice.findMany({
            where: { billingAccountId: account.id },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ])

      return {
        ok: true as const,
        org: {
          orgId: account.organizationId,
          orgName: cachedOrg?.name ?? account.organizationId,
          balance: account.balance.toFixed(2),
          currency: account.currency,
          status: account.status,
          createdAt: account.createdAt.toISOString(),
          subscriptions: subscriptions.map((sub) => ({
            id: sub.id,
            packageCode: sub.package?.code ?? "UNKNOWN",
            planCode: sub.plan?.code ?? "UNKNOWN",
            status: sub.status,
            billingMode: sub.billingMode,
          })),
          contacts: contacts.length,
          monthlySpend: monthlySpendResult._sum.amountIdr?.toFixed(2) ?? "0.00",
          recentInvoices: recentInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            totalAmountIdr: inv.totalAmount.toFixed(2),
            createdAt: inv.createdAt.toISOString(),
          })),
        },
      }
    } catch (error) {
      console.error("[AdminOrgDetail] Error:", error)
      return toServerError(set, "Unable to load organization details.")
    }
  })
}

export const adminOrgDetailRoutes = createAdminOrgDetailRoutes()
