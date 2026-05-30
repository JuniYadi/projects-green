import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { adminSubscriptionUpdateSchema } from "../billing.schemas"

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminSubscriptionRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; tenantRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminSubscriptionRouteDeps = {
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
    message: "You must be signed in to manage subscriptions.",
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
  getPlatformRole: AdminSubscriptionRouteDeps["getPlatformRole"]
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

export const createAdminSubscriptionRoutes = (
  deps: Partial<AdminSubscriptionRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    // PATCH /billing/admin/subscriptions/:id — Update subscription
    .patch("/admin/subscriptions/:id", async ({ params, body, set }) => {
      const auth = await authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      // Validate params
      const { id } = params as { id: string }
      if (!id) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Subscription ID is required.",
        }
      }

      // Parse and validate body
      const parsed = adminSubscriptionUpdateSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const updateData = parsed.data

      // Check admin access
      const actor = await resolveActor(auth, getPlatformRole)
      if (!isAdmin(actor)) {
        return toForbidden(
          set,
          "Only administrators can manage subscriptions."
        )
      }

      try {
        // Check subscription exists
        const existing = await prisma.subscription.findUnique({
          where: { id },
          select: { id: true },
        })

        if (!existing) {
          return toNotFound(set, "Subscription not found.")
        }

        // Validate pricing belongs to plan if both are being updated
        if (updateData.pricingId && updateData.planId) {
          const pricing = await prisma.pricing.findUnique({
            where: { id: updateData.pricingId },
            select: { planId: true },
          })
          if (!pricing || pricing.planId !== updateData.planId) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR",
              message: "Pricing does not belong to the specified plan.",
            }
          }
        }

        // Build update payload - only include fields that are provided
        const dataToUpdate: Record<string, unknown> = {}

        if (updateData.planId !== undefined) {
          dataToUpdate.planId = updateData.planId
        }

        if (updateData.pricingId !== undefined) {
          dataToUpdate.pricingId = updateData.pricingId
        }

        if (updateData.allocatedConfig !== undefined) {
          dataToUpdate.allocatedConfig = updateData.allocatedConfig
        }

        if (updateData.status !== undefined) {
          dataToUpdate.status = updateData.status
        }

        // If no updates, return current subscription
        if (Object.keys(dataToUpdate).length === 0) {
          const current = await prisma.subscription.findUnique({
            where: { id },
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
          })

          if (!current) {
            return toNotFound(set, "Subscription not found.")
          }

          return {
            ok: true as const,
            subscription: {
              id: current.id,
              packageCode: current.package.code,
              planCode: current.plan.code,
              regionCode: current.pricing.region.code,
              billingMode: current.pricing.billingMode,
              type: current.pricing.type,
              status: current.status,
              allocatedConfig: current.allocatedConfig as Record<string, unknown> | null,
              monthlyRateIdr: current.pricing.basePriceIdr.toFixed(2),
              currentPeriodEnd: current.currentPeriodEnd?.toISOString() ?? null,
            },
          }
        }

        // Update subscription
        await prisma.subscription.update({
          where: { id },
          data: dataToUpdate,
        })

        // Fetch updated subscription with relations
        const updated = await prisma.subscription.findUnique({
          where: { id },
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
        })

        if (!updated) {
          return toNotFound(set, "Subscription not found after update.")
        }

        // Format response
        const formatted = {
          id: updated.id,
          packageCode: updated.package.code,
          planCode: updated.plan.code,
          regionCode: updated.pricing.region.code,
          billingMode: updated.pricing.billingMode,
          type: updated.pricing.type,
          status: updated.status,
          allocatedConfig: updated.allocatedConfig as Record<string, unknown> | null,
          monthlyRateIdr: updated.pricing.basePriceIdr.toFixed(2),
          currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
        }

        return {
          ok: true as const,
          subscription: formatted,
        }
      } catch (error) {
        console.error("[AdminSubscription] Error:", error)
        return toServerError(set, "Unable to update subscription.")
      }
    })
}

export const adminSubscriptionRoutes = createAdminSubscriptionRoutes()