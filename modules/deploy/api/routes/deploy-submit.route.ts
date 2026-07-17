import { Prisma } from "@prisma/client"
import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  hasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"
import { AppHostingBillingService } from "../../billing/app-hosting-billing.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { computeHourlyCostDecimal } from "../../deploy-pricing"
import {
  createOrUpdateStack,
  triggerDeploy,
} from "../../deploy-pipeline.service"
import { DEPLOY_TEMPLATES } from "../../deploy.constants"

/**
 * PGREEN-071 — Console Deploy Journey truth path.
 *
 * Single submit endpoint that turns a validated deploy configuration into
 * a durable stack + real deployment. It is the authoritative bridge from
 * the wizard's environment step to orchestration:
 *
 *   1. authorize (owner/admin or super admin)
 *   2. resolve the GitHub repository connection for the org
 *   3. upsert the ApplicationStack (source of truth)
 *   4. enforce the PAYG billing gate (hard block, not just advisory)
 *   5. trigger a real deployment (QUEUED) and return its id
 *
 * The wizard then monitors the returned deployId via the real
 * monitoring/pipeline endpoints — there is no simulated success path.
 */

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  return slug || "app"
}

const envVarSchema = t.Object({
  key: t.String(),
  value: t.String(),
  type: t.Optional(t.Union([t.Literal("plain"), t.Literal("secret")])),
  scope: t.Optional(
    t.Union([t.Literal("all"), t.Literal("build"), t.Literal("runtime")])
  ),
})

export const deploySubmitRoutes = new Elysia({ prefix: "/deploy" }).post(
  "/submit",
  async ({ body, set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }

    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Organization required" }
    }

    // Deploy is an owner/admin (or super admin) action.
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

    const sourceType = body.sourceType ?? "GITHUB"
    let repositoryConnectionId: string | null | undefined
    let name: string
    let slug: string

    if (sourceType === "TEMPLATE") {
      const template = DEPLOY_TEMPLATES.find((t) => t.id === body.templateId)
      if (!template) {
        set.status = 422
        return {
          ok: false,
          error: "UNKNOWN_TEMPLATE",
          message: "Unknown templateId",
        }
      }
      repositoryConnectionId = null
      name = body.name?.trim() || template.name
      slug = slugify(name)
    } else {
      // Resolve the repository connection for GitHub deploys.
      const rawRepoId = String(body.repositoryId)
      if (!/^\d+$/.test(rawRepoId)) {
        set.status = 422
        return {
          ok: false,
          error: "INVALID_REPOSITORY",
          message: "A valid numeric GitHub repository id is required.",
        }
      }
      const repositoryId = BigInt(rawRepoId)

      const connection = await prisma.githubRepositoryConnection.findFirst({
        where: {
          githubRepositoryId: repositoryId,
          enabled: true,
          installation: {
            organizationId: auth.organizationId,
          },
        },
      })

      if (!connection) {
        set.status = 404
        return {
          ok: false,
          error: "REPOSITORY_NOT_CONNECTED",
          message:
            "This repository is not connected. Connect it via the GitHub App first.",
        }
      }
      repositoryConnectionId = connection.id
      slug = slugify(connection.repoName || body.name || "app")
      name = connection.repoName || body.name || slug
    }

    const resourcePlanId = body.resourcePlanId
    const billingMode = body.billingMode ?? "PAYG"
    const hourlyCost = computeHourlyCostDecimal({
      resourcePlanId,
      cpu: body.cpu ?? null,
      memory: body.memory ?? null,
    })

    // Persist the stack as the single source of truth before any deploy.
    let stack
    try {
      stack = await createOrUpdateStack({
        organizationId: auth.organizationId,
        name,
        slug,
        sourceType: sourceType === "TEMPLATE" ? "TEMPLATE" : "GITHUB",
        repositoryConnectionId,
        branchName: body.branchName || null,
        rootDirectory: body.rootDirectory || null,
        framework: body.framework ?? null,
        frameworkVersion: body.frameworkVersion ?? null,
        buildCommand: body.buildCommand ?? null,
        dockerfileDetected: body.useDockerfile ?? false,
        primaryEngine: body.primaryEngine ?? null,
        primaryEngineVersion: body.primaryEngineVersion ?? null,
        secondaryEngine: body.secondaryEngine ?? null,
        secondaryEngineVersion: body.secondaryEngineVersion ?? null,
        defaultPort: body.defaultPort ?? null,
        resourcePlanId,
        billingMode,
        hourlyCost: hourlyCost.toString(),
        cpu: body.cpu ?? null,
        memory: body.memory ?? null,
        customDomain: body.customDomain ?? null,
        subdomain: body.subdomain ?? null,
        envVars: body.envVars ?? [],
      })
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "STACK_DEPLOY_IN_PROGRESS"
      ) {
        set.status = 409
        return {
          ok: false,
          error: "STACK_DEPLOY_IN_PROGRESS",
          message:
            "A deployment is already in progress for this app. Wait for it to finish.",
        }
      }
      throw error
    }

    // Hard billing gate for PAYG — mirrors deploy-trigger.route.ts so the
    // submit flow cannot bypass the required-balance enforcement.
    if (billingMode === "PAYG" && resourcePlanId === "payg") {
      const transactions = new BillingTransactionService(prisma)
      const billingService = new AppHostingBillingService(prisma, transactions)
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
        if (
          error instanceof Error &&
          error.message === "BILLING_ACCOUNT_NOT_FOUND"
        ) {
          set.status = 402
          return {
            ok: false,
            error: "BILLING_ACCOUNT_NOT_FOUND",
            message: "No billing account found for this organization.",
            topupUrl: "/console/billing/topup",
          }
        }
        throw error
      }
    }

    const triggerType = sourceType === "TEMPLATE" ? "TEMPLATE" : "MANUAL"
    const result = await triggerDeploy({
      stackId: stack.id,
      triggerType,
    })

    return {
      ok: true,
      data: {
        stackId: stack.id,
        stackSlug: stack.slug,
        deploymentId: result.deploymentId,
        status: result.status,
        hourlyCost: hourlyCost.toString(),
      },
    }
  },
  {
    body: t.Object({
      sourceType: t.Optional(t.Union([t.Literal("GITHUB"), t.Literal("TEMPLATE")])),
      templateId: t.Optional(t.String()),
      repositoryId: t.Optional(t.String()),
      name: t.Optional(t.String()),
      branchName: t.Optional(t.String()),
      rootDirectory: t.Optional(t.String()),
      framework: t.Optional(t.String()),
      frameworkVersion: t.Optional(t.String()),
      buildCommand: t.Optional(t.String()),
      useDockerfile: t.Optional(t.Boolean()),
      primaryEngine: t.Optional(t.String()),
      primaryEngineVersion: t.Optional(t.String()),
      secondaryEngine: t.Optional(t.String()),
      secondaryEngineVersion: t.Optional(t.String()),
      defaultPort: t.Optional(t.Number()),
      resourcePlanId: t.Union([
        t.Literal("starter"),
        t.Literal("pro"),
        t.Literal("payg"),
      ]),
      billingMode: t.Optional(
        t.Union([t.Literal("PAYG"), t.Literal("PACKAGE")])
      ),
      cpu: t.Optional(t.Number()),
      memory: t.Optional(t.Number()),
      paygBufferHours: t.Optional(t.Number()),
      customDomain: t.Optional(t.String()),
      subdomain: t.Optional(t.String()),
      envVars: t.Optional(t.Array(envVarSchema)),
    }),
  }
)
