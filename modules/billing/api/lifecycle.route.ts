import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import type { BillingAuthContext } from "./subscriptions.route"
import {
  SubscriptionLifecycleService,
  SubscriptionNotFoundError,
  SubscriptionAlreadyCancelledError,
  SamePlanError,
  PricingNotFoundError,
} from "@/modules/billing/lifecycle.service"
import {
  cancelSubscriptionSchema,
  reinstateSubscriptionSchema,
  changePlanPreviewSchema,
  changePlanSchema,
} from "./lifecycle.schemas"

type RouteSet = {
  status?: number | string
}

type LifecycleRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  lifecycleService?: SubscriptionLifecycleService
}

const defaultDeps: LifecycleRouteDeps = {
  authenticate: () => withAuth(),
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

/** Resolve auth + organization. Returns error response or { organizationId, userId }. */
async function resolveOrg(
  auth: BillingAuthContext,
  set: RouteSet
): Promise<
  | { organizationId: string; userId: string }
  | ReturnType<typeof toUnauthorized | typeof toForbidden>
> {
  if (!auth.user) return toUnauthorized(set)
  if (!auth.organizationId)
    return toForbidden(set, "No active organization found for billing.")

  // Resolve the billing account tenantId — subscriptions are keyed on that.
  const billingAccount = await prisma.billingAccount.findUnique({
    where: { organizationId: auth.organizationId },
    select: { tenantId: true },
  })
  if (!billingAccount?.tenantId) {
    return toForbidden(set, "No billing account found.")
  }

  return { organizationId: billingAccount.tenantId, userId: auth.user.id }
}

export const createLifecycleRoutes = (
  deps: Partial<LifecycleRouteDeps> = {}
) => {
  const { authenticate, lifecycleService } = {
    ...defaultDeps,
    ...deps,
  }

  const service = lifecycleService ?? new SubscriptionLifecycleService(prisma)

  return (
    new Elysia()
      // POST /subscriptions/:id/cancel — cancel at period end
      .post(
        "/subscriptions/:id/cancel",
        async ({ params, body, set }) => {
          const auth = await authenticate()
          const ctx = await resolveOrg(auth, set)
          if ("error" in ctx) return ctx

          const { id } = params as { id: string }

          const parsed = cancelSubscriptionSchema.safeParse(body)
          if (!parsed.success) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Please fix the highlighted fields and try again.",
              fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
            }
          }

          try {
            const result = await service.cancelAtPeriodEnd(
              ctx.organizationId,
              id,
              parsed.data.reason
            )
            return result
          } catch (error) {
            if (error instanceof SubscriptionNotFoundError) {
              return toNotFound(set, "Subscription not found.")
            }
            if (error instanceof SubscriptionAlreadyCancelledError) {
              set.status = 422
              return {
                ok: false as const,
                error: "ALREADY_CANCELLED" as const,
                message: error.message,
              }
            }
            console.error("[LifecycleRoute] cancel error:", error)
            return toServerError(
              set,
              "Something went wrong while cancelling the subscription."
            )
          }
        },
        {
          body: cancelSubscriptionSchema,
        }
      )
      // POST /subscriptions/:id/reinstate — undo pending cancellation
      .post(
        "/subscriptions/:id/reinstate",
        async ({ params, body, set }) => {
          const auth = await authenticate()
          const ctx = await resolveOrg(auth, set)
          if ("error" in ctx) return ctx

          const { id } = params as { id: string }

          const parsed = reinstateSubscriptionSchema.safeParse(body)
          if (!parsed.success) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Please fix the highlighted fields and try again.",
              fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
            }
          }

          try {
            const result = await service.reinstate(
              ctx.organizationId,
              id,
              parsed.data.reason
            )
            return result
          } catch (error) {
            if (error instanceof SubscriptionNotFoundError) {
              return toNotFound(
                set,
                "Subscription not found or not pending cancellation."
              )
            }
            console.error("[LifecycleRoute] reinstate error:", error)
            return toServerError(
              set,
              "Something went wrong while reinstating the subscription."
            )
          }
        },
        {
          body: reinstateSubscriptionSchema,
        }
      )
      // GET /subscriptions/:id/change-plan/preview — preview plan/term change
      .get(
        "/subscriptions/:id/change-plan/preview",
        async ({ params, query, set }) => {
          const auth = await authenticate()
          const ctx = await resolveOrg(auth, set)
          if ("error" in ctx) return ctx

          const { id } = params as { id: string }

          const parsed = changePlanPreviewSchema.safeParse(query)
          if (!parsed.success) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Invalid pricing ID.",
            }
          }

          try {
            const result = await service.previewChangePlan(
              ctx.organizationId,
              id,
              parsed.data.pricingId
            )
            return result
          } catch (error) {
            if (error instanceof SubscriptionNotFoundError) {
              return toNotFound(set, "Subscription not found.")
            }
            if (error instanceof PricingNotFoundError) {
              set.status = 422
              return {
                ok: false as const,
                error: "PRICING_NOT_FOUND" as const,
                message: "Pricing not found.",
              }
            }
            console.error("[LifecycleRoute] previewChangePlan error:", error)
            return toServerError(
              set,
              "Something went wrong while previewing the plan change."
            )
          }
        }
      )
      // POST /subscriptions/:id/change-plan — commit plan/term change
      .post(
        "/subscriptions/:id/change-plan",
        async ({ params, body, set }) => {
          const auth = await authenticate()
          const ctx = await resolveOrg(auth, set)
          if ("error" in ctx) return ctx

          const { id } = params as { id: string }

          const parsed = changePlanSchema.safeParse(body)
          if (!parsed.success) {
            set.status = 422
            return {
              ok: false as const,
              error: "VALIDATION_ERROR" as const,
              message: "Please fix the highlighted fields and try again.",
              fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
            }
          }

          try {
            const result = await service.changePlan(
              ctx.organizationId,
              id,
              parsed.data.pricingId
            )
            return result
          } catch (error) {
            if (error instanceof SubscriptionNotFoundError) {
              return toNotFound(set, "Subscription not found.")
            }
            if (error instanceof PricingNotFoundError) {
              set.status = 422
              return {
                ok: false as const,
                error: "PRICING_NOT_FOUND" as const,
                message: "Pricing not found.",
              }
            }
            if (error instanceof SamePlanError) {
              set.status = 422
              return {
                ok: false as const,
                error: "SAME_PLAN" as const,
                message: error.message,
              }
            }
            console.error("[LifecycleRoute] changePlan error:", error)
            return toServerError(
              set,
              "Something went wrong while changing the subscription plan."
            )
          }
        },
        {
          body: changePlanSchema,
        }
      )
  )
}

export const lifecycleRoutes = createLifecycleRoutes()
