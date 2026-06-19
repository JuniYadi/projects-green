import { Prisma } from "@prisma/client"
import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { triggerDeploy } from "../../deploy-pipeline.service"
import {
  rollbackDeployment,
  getRollbackOptions,
} from "../../deploy-rollback.service"
import {
  resolveTenantRoleFromClaims,
  hasScopedSuperAdminClaim,
} from "@/modules/tenants/tenant-policy"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { AppHostingBillingService } from "../../billing/app-hosting-billing.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

export const deployTriggerRoutes = new Elysia({ prefix: "/deploy" })
  .post(
    "/trigger/:stackId",
    async ({ params, body, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required",
        }
      }

      // Check deploy permissions
      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)
      if (!isSuperAdmin) {
        const tenantRole = resolveTenantRoleFromClaims(
          auth.role ?? null,
          auth.roles ?? null
        )
        if (tenantRole !== "owner" && tenantRole !== "admin") {
          set.status = 403
          return {
            ok: false,
            error: "FORBIDDEN",
            message: "Admin/Owner role required for deploy operations",
          }
        }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: { id: params.stackId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
      }

      if (stack.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      // Reject deploy for SUSPENDED stacks (billing-level block)
      const stackMeta = (stack.metadataJson ?? {}) as Record<string, unknown>
      if (stackMeta.billingState === "SUSPENDED") {
        set.status = 402
        return {
          ok: false,
          error: "STACK_SUSPENDED",
          message:
            "This stack is suspended due to payment issues. Please top up your balance.",
          topupUrl: "/console/billing/topup",
        }
      }

      // Billing gate: check balance before deploy for PAYG stacks
      if (stack.billingMode === "PAYG" && stack.resourcePlanId === "payg") {
        const hourlyCost = stack.hourlyCost
        if (!hourlyCost) {
          set.status = 422
          return {
            ok: false,
            error: "MISSING_HOURLY_COST",
            message: "PAYG stack is missing hourly cost configuration.",
          }
        }

        const transactions = new BillingTransactionService(prisma)
        const billingService = new AppHostingBillingService(
          prisma,
          transactions
        )
        try {
          await billingService.assertCanStartPayg({
            organizationId: auth.organizationId,
            hourlyCost: new Prisma.Decimal(String(hourlyCost)),
            bufferHours: body.paygBufferHours,
          })
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "INSUFFICIENT_PAYG_BUFFER"
          ) {
            set.status = 402
            return {
              ok: false,
              error: "INSUFFICIENT_PAYG_BUFFER",
              message:
                "Your balance must cover the configured runtime buffer before deploying PAYG apps.",
              topupUrl: "/console/billing/topup",
            }
          }
          throw error
        }
      }

      const result = await triggerDeploy({
        stackId: params.stackId,
        triggerType: "MANUAL",
      })

      return { ok: true, data: result }
    },
    {
      params: t.Object({
        stackId: t.String(),
      }),
      body: t.Object({
        paygBufferHours: t.Optional(t.Number()),
      }),
    }
  )
  .post(
    "/rollback/:stackId",
    async ({ params, body, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required",
        }
      }

      // Check deploy permissions
      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)
      if (!isSuperAdmin) {
        const tenantRole = resolveTenantRoleFromClaims(
          auth.role ?? null,
          auth.roles ?? null
        )
        if (tenantRole !== "owner" && tenantRole !== "admin") {
          set.status = 403
          return {
            ok: false,
            error: "FORBIDDEN",
            message: "Admin/Owner role required for deploy operations",
          }
        }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: { id: params.stackId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
      }

      if (stack.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      // Reject rollback for SUSPENDED stacks
      const rollbackMeta = (stack.metadataJson ?? {}) as Record<string, unknown>
      if (rollbackMeta.billingState === "SUSPENDED") {
        set.status = 402
        return {
          ok: false,
          error: "STACK_SUSPENDED",
          message:
            "This stack is suspended due to payment issues. Please top up your balance.",
          topupUrl: "/console/billing/topup",
        }
      }

      // Billing gate for PAYG rollback — same check as deploy trigger
      if (stack.billingMode === "PAYG" && stack.resourcePlanId === "payg") {
        const hourlyCost = stack.hourlyCost
        if (hourlyCost) {
          const transactions = new BillingTransactionService(prisma)
          const billingService = new AppHostingBillingService(
            prisma,
            transactions
          )
          try {
            await billingService.assertCanStartPayg({
              organizationId: auth.organizationId,
              hourlyCost: new Prisma.Decimal(String(hourlyCost)),
            })
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "INSUFFICIENT_PAYG_BUFFER"
            ) {
              set.status = 402
              return {
                ok: false,
                error: "INSUFFICIENT_PAYG_BUFFER",
                message:
                  "Your balance must cover at least 24 hours of runtime before rolling back PAYG apps.",
                topupUrl: "/console/billing/topup",
              }
            }
            throw error
          }
        }
      }

      const result = await rollbackDeployment({
        stackId: params.stackId,
        targetDeploymentId: body.targetDeploymentId,
      })

      return { ok: true, data: result }
    },
    {
      params: t.Object({
        stackId: t.String(),
      }),
      body: t.Object({
        targetDeploymentId: t.String(),
      }),
    }
  )
  .get(
    "/rollback-options/:stackId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: { id: params.stackId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
      }

      if (stack.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const options = await getRollbackOptions(params.stackId)
      return { ok: true, data: options }
    },
    {
      params: t.Object({
        stackId: t.String(),
      }),
    }
  )
