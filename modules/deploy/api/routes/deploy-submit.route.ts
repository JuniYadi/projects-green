import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  hasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"
import { computeHourlyCostDecimal } from "../../deploy-pricing"
import {
  createOrUpdateStack,
  triggerDeploy,
} from "../../deploy-pipeline.service"
import { ensureManagedDomainForStack } from "@/modules/deploy/app-hosting-edge.service"
import type { AppManagedStock } from "@prisma/client"
import { claimManagedStock } from "@/modules/deploy/app-managed-stock.service"
import { assertDeployExecutionGates } from "../../deploy-execution-gates"
import { DEPLOY_TEMPLATES } from "../../deploy.constants"
import {
  MANAGED_APP_TEMPLATES,
  type ManagedAppTemplate,
} from "../../managed-app-templates"
import { parsePublicGitUrl } from "../../public-source"

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
  type: t.Optional(
    t.Union([
      t.Literal("plain"),
      t.Literal("secret"),
      t.Literal("secret_ref"),
      t.Literal("secret_shared_ref"),
    ])
  ),
  scope: t.Optional(
    t.Union([t.Literal("all"), t.Literal("build"), t.Literal("runtime")])
  ),
  source: t.Optional(
    t.Union([t.Literal("vault"), t.Literal("managed_service")])
  ),
  serviceCredentialId: t.Optional(t.String()),
  vaultPath: t.Optional(t.String()),
  vaultKey: t.Optional(t.String()),
  version: t.Optional(t.Number()),
  referenceLabel: t.Optional(t.String()),
  lastUpdatedAt: t.Optional(t.String()),
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
    let publicSourceUrl: string | null = null
    let publicSourceRef: string | null = null
    let name: string
    let slug: string
    let managedTemplate: ManagedAppTemplate | undefined

    if (sourceType === "MANAGED_TEMPLATE") {
      managedTemplate = MANAGED_APP_TEMPLATES.find(
        (template) => template.id === body.templateId
      )
      if (!managedTemplate) {
        set.status = 422
        return {
          ok: false,
          error: "UNKNOWN_TEMPLATE",
          message: "Unknown managed templateId",
        }
      }
      repositoryConnectionId = null
      name = body.name?.trim() || managedTemplate.name
      slug = slugify(name)
    } else if (sourceType === "TEMPLATE") {
      const template = DEPLOY_TEMPLATES.find(
        (item) => item.id === body.templateId
      )
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
    } else if (sourceType === "PUBLIC") {
      const parsed = parsePublicGitUrl(body.publicSourceUrl ?? "")
      if ("error" in parsed) {
        set.status = 422
        return {
          ok: false,
          error: "INVALID_PUBLIC_SOURCE",
          message: parsed.error,
        }
      }
      repositoryConnectionId = null
      publicSourceUrl = parsed.url
      publicSourceRef =
        body.publicSourceRef?.trim() || body.branchName?.trim() || "main"
      const derivedName = parsed.host.split(".")[0] || "app"
      name = body.name?.trim() || derivedName
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

    // If deploying a managed template with managed DB, claim stock first before creating stack to avoid orphaned stacks
    let claimedStock: AppManagedStock | undefined
    if (managedTemplate) {
      try {
        claimedStock = await claimManagedStock({
          serviceType: managedTemplate.engineType,
          stackId: "pending",
          orgId: auth.organizationId,
          environment: "prod",
        })
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "MANAGED_STOCK_UNAVAILABLE",
          message:
            error instanceof Error
              ? error.message
              : "Failed to claim managed database stock",
        }
      }
    }

    // Persist the stack as the single source of truth before any deploy.
    let stack
    try {
      stack = await createOrUpdateStack({
        organizationId: auth.organizationId,
        name,
        slug,
        sourceType:
          sourceType === "MANAGED_TEMPLATE" || sourceType === "TEMPLATE"
            ? "TEMPLATE"
            : sourceType === "PUBLIC"
              ? "PUBLIC"
              : "GITHUB",
        repositoryConnectionId,
        publicSourceUrl,
        publicSourceRef,
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
        imageRepository: managedTemplate?.imageRepository ?? null,
      })
    } catch (error) {
      if (claimedStock) {
        await prisma.appManagedStock
          .update({
            where: { id: claimedStock.id },
            data: {
              status: "AVAILABLE",
              allocatedStackId: null,
              allocatedAt: null,
            },
          })
          .catch(() => {})
      }
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

    if (managedTemplate && claimedStock) {
      await prisma.appManagedStock
        .update({
          where: { id: claimedStock.id },
          data: { allocatedStackId: stack.id },
        })
        .catch(() => {})
    }
    try {
      await assertDeployExecutionGates({
        organizationId: auth.organizationId,
        stackId: stack.id,
        billingMode,
        resourcePlanId,
        hourlyCost: Number(hourlyCost),
        paygBufferHours: body.paygBufferHours ?? 24,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      if (message === "INSUFFICIENT_PAYG_BUFFER") {
        set.status = 402
        return {
          ok: false,
          error: "INSUFFICIENT_PAYG_BUFFER",
          message:
            "Your balance must cover the configured runtime buffer before deploying PAYG apps.",
          topupUrl: "/console/billing/topup",
        }
      }
      if (message === "BILLING_ACCOUNT_NOT_FOUND") {
        set.status = 402
        return {
          ok: false,
          error: "BILLING_ACCOUNT_NOT_FOUND",
          message: "No billing account found for this organization.",
          topupUrl: "/console/billing/topup",
        }
      }
      if (message === "NO_ACTIVE_SUBSCRIPTION") {
        set.status = 402
        return {
          ok: false,
          error: "NO_ACTIVE_SUBSCRIPTION",
          message:
            "No active App Hosting subscription found for this organization.",
          subscribeUrl: "/console/billing/catalog",
        }
      }
      if (message === "STACK_QUOTA_EXCEEDED") {
        set.status = 403
        return {
          ok: false,
          error: "STACK_QUOTA_EXCEEDED",
          message:
            "You have reached the maximum allowed apps for your current plan.",
          upgradeUrl: "/console/billing/catalog",
        }
      }
      if (
        message.includes("No active default App Hosting cluster") ||
        message.includes("Multiple active default App Hosting clusters")
      ) {
        set.status = 409
        return {
          ok: false,
          error: "APP_HOSTING_CLUSTER_NOT_CONFIGURED",
          message,
        }
      }
      throw error
    }
    await ensureManagedDomainForStack(stack.id)

    const triggerType =
      sourceType === "TEMPLATE"
        ? "TEMPLATE"
        : sourceType === "PUBLIC"
          ? "PUBLIC"
          : "MANUAL"
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
      sourceType: t.Optional(
        t.Union([
          t.Literal("GITHUB"),
          t.Literal("TEMPLATE"),
          t.Literal("MANAGED_TEMPLATE"),
          t.Literal("PUBLIC"),
        ])
      ),
      publicSourceUrl: t.Optional(t.String()),
      publicSourceRef: t.Optional(t.String()),
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
