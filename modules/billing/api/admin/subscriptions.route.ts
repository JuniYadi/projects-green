import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { adminSubscriptionUpdateSchema, adminSubscriptionCreateSchema } from "../billing.schemas"
import { emitBillingAudit } from "@/modules/billing/audit/audit.service"

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
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
  isAdmin: (actor: {
    platformRole: PlatformAccessRole
    orgRole: string | null | undefined
  }) => boolean
}

const defaultDeps: AdminSubscriptionRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  },
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
    orgRole: auth.role,
  }
}

export const createAdminSubscriptionRoutes = (
  deps: Partial<AdminSubscriptionRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  const listQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
    organizationId: z.string().optional(),
  })

  return (
    new Elysia()
      // GET /billing/admin/subscriptions — List all subscriptions
      .get("/admin/subscriptions", async ({ query, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(
            set,
            "Only administrators can view all subscriptions."
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

        const { page, limit, status, organizationId } = parsed.data
        const skip = (page - 1) * limit

        try {
          const where: Prisma.ServiceSubscriptionWhereInput = {}

          if (actor.platformRole !== "super_admin" && auth.organizationId) {
            where.organizationId = auth.organizationId
          }

          if (status) where.status = status
          if (organizationId) where.organizationId = organizationId

          const [subscriptions, total] = await Promise.all([
            prisma.serviceSubscription.findMany({
              where,
              include: {
                package: { select: { code: true } },
                plan: { select: { code: true } },
                pricing: {
                  select: {
                    billingMode: true,
                    type: true,
                    basePriceIdr: true,
                    region: { select: { code: true } },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              skip,
              take: limit,
            }),
            prisma.serviceSubscription.count({ where }),
          ])

          const formatted = subscriptions.map((sub) => ({
            id: sub.id,
            organizationId: sub.organizationId,
            packageCode: sub.package.code,
            planCode: sub.plan.code,
            regionCode: sub.pricing.region.code,
            billingMode: sub.pricing.billingMode,
            type: sub.pricing.type,
            status: sub.status,
            allocatedConfig: sub.allocatedConfig as Record<
              string,
              unknown
            > | null,
            monthlyRateIdr: sub.pricing.basePriceIdr.toFixed(2),
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }))

          return {
            ok: true as const,
            subscriptions: formatted,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          }
        } catch (error) {
          console.error("[AdminSubscriptionsList] Error:", error)
          return toServerError(set, "Unable to load subscriptions.")
        }
      })
      // POST /billing/admin/subscriptions — Create subscription on behalf of org
      .post("/admin/subscriptions", async ({ body, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(
            set,
            "Only administrators can create subscriptions."
          )
        }

        const parsed = adminSubscriptionCreateSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
          }
        }

        const {
          organizationId,
          packageId,
          planId,
          pricingId,
          type,
          billingMode,
          currentPeriodStart,
          currentPeriodEnd,
          allocatedConfig,
          metadata,
        } = parsed.data

        try {
          // Validate that package, plan, and pricing exist
          const [servicePackage, servicePlan, pricing] = await Promise.all([
            prisma.servicePackage.findUnique({ where: { id: packageId } }),
            prisma.servicePlan.findUnique({ where: { id: planId } }),
            prisma.servicePricing.findUnique({ where: { id: pricingId } }),
          ])

          if (!servicePackage) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Package not found.",
            }
          }

          if (!servicePlan) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Plan not found.",
            }
          }

          if (!pricing) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Pricing not found.",
            }
          }

          // Check for existing subscription with same package+plan for this org
          const existing = await prisma.serviceSubscription.findFirst({
            where: {
              organizationId,
              packageId,
              planId,
              status: { not: "CANCELLED" },
            },
          })

          if (existing) {
            set.status = 409
            return {
              ok: false as const,
              error: "CONFLICT" as const,
              message: "An active subscription already exists for this package and plan.",
            }
          }

          const subscription = await prisma.serviceSubscription.create({
            data: {
              organizationId,
              packageId,
              planId,
              pricingId,
              type,
              billingMode,
              status: "ACTIVE",
              currentPeriodStart,
              currentPeriodEnd,
              allocatedConfig: (allocatedConfig ?? null) as Prisma.InputJsonValue,
              metadata: (metadata ?? null) as Prisma.InputJsonValue,
            },
          })

          // Audit logging
          emitBillingAudit({
            entityType: "ServiceSubscription",
            entityId: subscription.id,
            action: "ORDER_CREATED",
            actorId: auth.user?.id,
            context: {
              organizationId,
              packageId,
              planId,
              pricingId,
              type,
              billingMode,
            },
          })

          return {
            ok: true as const,
            subscription: {
              id: subscription.id,
              organizationId: subscription.organizationId,
              packageId: subscription.packageId,
              planId: subscription.planId,
              pricingId: subscription.pricingId,
              type: subscription.type,
              billingMode: subscription.billingMode,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart.toISOString(),
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            },
          }
        } catch (error) {
          console.error("[AdminSubscriptionCreate] Error:", error)
          return toServerError(set, "Unable to create subscription.")
        }
      })
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
          const existing = await prisma.serviceSubscription.findUnique({
            where: { id },
            select: { id: true, organizationId: true, status: true },
          })

          if (!existing) {
            return toNotFound(set, "Subscription not found.")
          }

          // Validate pricing belongs to plan if both are being updated
          if (updateData.pricingId && updateData.planId) {
            const pricing = await prisma.servicePricing.findUnique({
              where: { id: updateData.pricingId },
              select: { planId: true },
            })
            if (!pricing || pricing.planId !== updateData.planId) {
              set.status = 422
              return {
                ok: false as const,
                error: "VALIDATION_ERROR",
                message:
                  "ServicePricing does not belong to the specified plan.",
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
            const current = await prisma.serviceSubscription.findUnique({
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
                allocatedConfig: current.allocatedConfig as Record<
                  string,
                  unknown
                > | null,
                monthlyRateIdr: current.pricing.basePriceIdr.toFixed(2),
                currentPeriodEnd:
                  current.currentPeriodEnd?.toISOString() ?? null,
              },
            }
          }

          // Update subscription
          await prisma.serviceSubscription.update({
            where: { id },
            data: dataToUpdate,
          })

          // Fetch updated subscription with relations
          const updated = await prisma.serviceSubscription.findUnique({
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

          // Audit logging
          emitBillingAudit({
            entityType: "ServiceSubscription",
            entityId: updated.id,
            action: "UPDATED",
            actorId: auth.user?.id,
            context: {
              previousStatus: existing.status,
              newStatus: (dataToUpdate.status as string) ?? existing.status,
              changes: Object.keys(dataToUpdate),
            },
          })

          // Format response
          const formatted = {
            id: updated.id,
            packageCode: updated.package.code,
            planCode: updated.plan.code,
            regionCode: updated.pricing.region.code,
            billingMode: updated.pricing.billingMode,
            type: updated.pricing.type,
            status: updated.status,
            allocatedConfig: updated.allocatedConfig as Record<
              string,
              unknown
            > | null,
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
  )
}

export const adminSubscriptionRoutes = createAdminSubscriptionRoutes()
