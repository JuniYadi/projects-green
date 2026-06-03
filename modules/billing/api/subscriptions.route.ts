import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type BillingSubscriptionsRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
}

const defaultDeps: BillingSubscriptionsRouteDeps = {
  authenticate: () => withAuth(),
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view subscriptions.",
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

export const createBillingSubscriptionsRoutes = (
  deps: Partial<BillingSubscriptionsRouteDeps> = {}
) => {
  const { authenticate } = { ...defaultDeps, ...deps }

  return new Elysia()
    .get("/subscriptions", async ({ set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      if (!auth.organizationId) {
        return toForbidden(set, "No active organization found for billing.")
      }

      try {
        const billingAccount = await prisma.billingAccount.findUnique({
          where: { organizationId: auth.organizationId },
          select: { tenantId: true },
        })

        if (!billingAccount?.tenantId) {
          return {
            ok: true as const,
            subscriptions: [],
          }
        }

        // Fetch all active subscriptions for the organization tenant.
        const subscriptions = await prisma.subscription.findMany({
          where: { organizationId: billingAccount.tenantId },
          include: {
            plan: { select: { code: true, resources: true } },
            pricing: {
              include: {
                region: { select: { code: true } },
                servicePlan: { select: { code: true, packageId: true } },
              },
            },
            package: { select: { code: true } },
          },
          orderBy: { createdAt: "asc" },
        })

        // Format response
        const formattedSubscriptions = subscriptions.map((sub) => {
          const packageCode = sub.package.code
          const planCode = sub.plan.code
          const regionCode = sub.pricing.region.code
          const monthlyRateIdr = sub.pricing.basePriceIdr.toFixed(2)

          // Build common fields
          const base = {
            id: sub.id,
            packageCode,
            planCode,
            regionCode,
            billingMode: sub.pricing.billingMode,
            type: sub.pricing.type,
            status: sub.status,
            allocatedConfig: sub.allocatedConfig as Record<string, unknown> | null,
            monthlyRateIdr,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }

          // Add package-specific fields
          if (packageCode === "WHATSAPP") {
            const resources = sub.plan.resources as {
              quotaIn: number | null
              quotaOut: number | null
              dailyPerDevice: number | null
              devices: number | null
            } | null

            return {
              ...base,
              quotaIn: resources?.quotaIn ?? null,
              quotaOut: resources?.quotaOut ?? null,
              dailyPerDevice: resources?.dailyPerDevice ?? null,
            }
          }

          return base
        })

        return {
          ok: true as const,
          subscriptions: formattedSubscriptions,
        }
      } catch (error) {
        console.error("[BillingSubscriptions] Error:", error)
        return toServerError(set, "Unable to load subscriptions right now.")
      }
    })
}

export const billingSubscriptionsRoutes = createBillingSubscriptionsRoutes()