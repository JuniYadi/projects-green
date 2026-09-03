import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { releaseManagedStock } from "@/modules/deploy/app-managed-stock.service"
import { resolveDefaultAppHostingClusterId } from "@/modules/deploy/cluster-integration.service"
import { syncJenkinsPipeline } from "@/modules/jenkins/jenkins-sync.service"
import { VaultSecretsService } from "@/modules/secrets/vault-secrets.service"
/**
 * PGREEN-070 — Deployment Orchestration
 *
 * Resolved input used to create or update the durable ApplicationStack
 * before a deployment is triggered. Field resolution (owner/repo →
 * repositoryConnectionId, slug generation) happens upstream; this layer
 * persists the stack as the single source of truth for deploys.
 */
export type StackUpsertInput = {
  organizationId: string
  name: string
  slug: string
  sourceType: "GITHUB" | "TEMPLATE" | "PUBLIC"
  repositoryConnectionId?: string | null
  publicSourceUrl?: string | null
  publicSourceRef?: string | null
  branchName?: string | null
  rootDirectory?: string | null
  framework?: string | null
  frameworkVersion?: string | null
  buildCommand?: string | null
  startCommand?: string | null
  dockerfileDetected: boolean
  primaryEngine?: string | null
  primaryEngineVersion?: string | null
  secondaryEngine?: string | null
  secondaryEngineVersion?: string | null
  defaultPort?: number | null
  resourcePlanId?: string | null
  billingMode?: "PAYG" | "PACKAGE"
  hourlyCost?: string | number | null
  cpu?: number | null
  memory?: number | null
  customDomain?: string | null
  subdomain?: string | null
  envVars?: unknown[]
  imageRepository?: string | null
  deploymentType?: "deployment" | "statefulset" | null
  additionalPorts?: Array<{ port: number; name: string }> | null
  templateId?: string | null
}

const IN_PROGRESS_STATUSES = ["QUEUED", "BUILDING", "DEPLOYING"] as const

// ─── Jenkins Pipeline Sync ────────────────────────────────────────────────────

/**
 * Sync Jenkins pipeline DSL for a stack. Non-blocking — logs errors but
 * does not fail stack creation if Jenkins sync fails.
 */
async function syncJenkinsPipelineForStack(
  stack: {
    slug: string
    branchName: string
    framework: string | null
    repositoryConnectionId: string | null
  },
  env: "dev" | "prod" | "staging" = "dev"
): Promise<void> {
  try {
    // Need repositoryConnectionId to get installation info
    if (!stack.repositoryConnectionId) {
      console.log(
        `[jenkins-sync] Skipping — no repository connection for ${stack.slug}`
      )
      return
    }

    // Look up connection and installation
    const connection = await prisma.githubRepositoryConnection.findUnique({
      where: { id: stack.repositoryConnectionId },
      include: { installation: true },
    })

    if (!connection) {
      console.log(
        `[jenkins-sync] Skipping — connection not found for ${stack.slug}`
      )
      return
    }

    // Determine framework for pipeline type
    const framework = stack.framework ?? "docker"

    // Sync the pipeline
    const result = await syncJenkinsPipeline({
      installationId: Number(connection.installation.githubInstallationId),
      owner: connection.ownerLogin,
      repo: connection.repoName,
      slug: stack.slug,
      branch: stack.branchName,
      framework,
      env: env === "prod" ? "prod" : "dev",
    })

    console.log(
      `[jenkins-sync] ${result.action} pipeline for ${stack.slug}: ${result.filePath}`
    )
  } catch (error) {
    // Non-blocking — log but don't fail stack creation
    console.error(
      `[jenkins-sync] Failed to sync pipeline for ${stack.slug}:`,
      error
    )
  }
}

/**
 * Create or update the ApplicationStack for an organization by slug.
 *
 * Blocks mutation while a deployment is in progress so config changes
 * cannot race an active release (use case 13 duplicate/in-progress path).
 */
export async function createOrUpdateStack(input: StackUpsertInput) {
  const hourlyCost =
    input.hourlyCost == null
      ? null
      : new Prisma.Decimal(String(input.hourlyCost))

  const envVarsJson = (input.envVars ?? []) as Prisma.InputJsonValue

  let defaultClusterId: string | null = null
  try {
    defaultClusterId = await resolveDefaultAppHostingClusterId()
  } catch {
    defaultClusterId = null
  }

  const stack = await prisma.$transaction(async (tx) => {
    const existing = await tx.applicationStack.findUnique({
      where: {
        organizationId_slug: {
          organizationId: input.organizationId,
          slug: input.slug,
        },
      },
    })

    if (
      existing &&
      (IN_PROGRESS_STATUSES as readonly string[]).includes(existing.status)
    ) {
      throw new Error("STACK_DEPLOY_IN_PROGRESS")
    }

    const buildMetadata: Record<string, unknown> = {}
    if (input.frameworkVersion != null)
      buildMetadata.frameworkVersion = input.frameworkVersion
    if (input.startCommand != null)
      buildMetadata.startCommand = input.startCommand
    if (input.primaryEngine != null)
      buildMetadata.primaryEngine = input.primaryEngine
    if (input.primaryEngineVersion != null)
      buildMetadata.primaryEngineVersion = input.primaryEngineVersion
    if (input.secondaryEngine != null)
      buildMetadata.secondaryEngine = input.secondaryEngine
    if (input.secondaryEngineVersion != null)
      buildMetadata.secondaryEngineVersion = input.secondaryEngineVersion
    if (input.defaultPort != null) buildMetadata.defaultPort = input.defaultPort
    if (input.imageRepository != null)
      buildMetadata.imageRepository = input.imageRepository
    if (input.deploymentType != null)
      buildMetadata.deploymentType = input.deploymentType
    if (input.additionalPorts != null)
      buildMetadata.additionalPorts = input.additionalPorts
    if (input.templateId != null) buildMetadata.templateId = input.templateId

    // Merge with existing metadataJson on update
    const existingJson =
      (existing?.metadataJson as Record<string, unknown> | null) ?? {}
    const metadataJson = {
      ...existingJson,
      ...buildMetadata,
    } as Prisma.InputJsonValue

    const data = {
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      sourceType: input.sourceType,
      repositoryConnectionId: input.repositoryConnectionId ?? null,
      publicSourceUrl: input.publicSourceUrl ?? null,
      publicSourceRef: input.publicSourceRef ?? null,
      branchName: input.branchName || undefined,
      rootDirectory: input.rootDirectory || undefined,
      framework: input.framework ?? null,
      buildCommand: input.buildCommand ?? null,
      dockerfileDetected: input.dockerfileDetected,
      resourcePlanId: input.resourcePlanId ?? null,
      templateId: input.templateId ?? existing?.templateId ?? null,
      clusterId:
        input.sourceType === "TEMPLATE"
          ? (defaultClusterId ?? existing?.clusterId ?? null)
          : (existing?.clusterId ?? defaultClusterId),
      billingMode: input.billingMode ?? "PAYG",
      hourlyCost,
      cpu: input.cpu ?? null,
      memory: input.memory ?? null,
      customDomain: input.customDomain ?? null,
      subdomain: input.subdomain ?? null,
      envVarsJson,
      metadataJson:
        Object.keys(buildMetadata).length > 0
          ? metadataJson
          : (existingJson as Prisma.InputJsonValue),
    }

    if (existing) {
      return tx.applicationStack.update({
        where: { id: existing.id },
        data,
      })
    }

    return tx.applicationStack.create({ data })
  })
  // Determine env from slug (e.g., "app-myapp-prod" → "prod", "-staging" → "staging", default "dev")
  const env = stack.slug.endsWith("-prod")
    ? "prod"
    : stack.slug.endsWith("-staging")
      ? "staging"
      : "dev"

  // If envVars contains plain key-value pairs (or unreferenced secrets), write them into HashiCorp Vault
  if (Array.isArray(input.envVars) && input.envVars.length > 0) {
    const plainSecrets: Record<string, string> = {}
    for (const item of input.envVars) {
      if (
        typeof item === "object" &&
        item !== null &&
        "key" in item &&
        "value" in item
      ) {
        const envEntry = item as {
          key: string
          value: string
          type?: string
          source?: string
        }
        // If it's not already a resolved vault reference, collect it for Vault storage
        if (envEntry.source !== "vault" && envEntry.type !== "secret_ref") {
          const key = String(envEntry.key).trim()
          if (key) {
            plainSecrets[key] = String(envEntry.value ?? "")
          }
        }
      }
    }

    if (Object.keys(plainSecrets).length > 0) {
      try {
        const vaultService = new VaultSecretsService()
        await vaultService.writeSecrets({
          organizationId: stack.organizationId,
          stackId: stack.id,
          environment: env,
          secrets: plainSecrets,
        })
      } catch (vaultError) {
        console.warn(
          `[deploy-pipeline] Non-fatal: failed to store environment variables in Vault for stack ${stack.id}:`,
          vaultError
        )
      }
    }
  }

  // Non-blocking: sync Jenkins pipeline after stack is created/updated
  syncJenkinsPipelineForStack(
    {
      slug: stack.slug,
      branchName: stack.branchName,
      framework: stack.framework, // framework can be string | null
      repositoryConnectionId: stack.repositoryConnectionId,
    },
    env
  ).catch(() => {
    // Already logged in the function
  })

  return stack
}

/**
 * Delete an application stack and release any managed database stock.
 * Stock cleanup is deliberately non-fatal so stale Vault state cannot block
 * removal of the stack itself.
 */
export async function deleteStack(stackId: string) {
  await releaseManagedStock(stackId).catch((error) => {
    console.error(
      `[deleteStack] releaseManagedStock failed for stack ${stackId}:`,
      error
    )
  })
  return prisma.applicationStack.delete({ where: { id: stackId } })
}

export async function triggerDeploy(params: {
  stackId: string
  triggerType?: "MANUAL" | "GITHUB" | "TEMPLATE" | "PUBLIC"
}) {
  // Count previous non-rollback deployments to set attempt number
  const previousAttempts = await prisma.applicationDeployment.count({
    where: { stackId: params.stackId, rollbackOfId: null },
  })

  // Use transaction to prevent race condition between status check and create
  const deployment = await prisma.$transaction(async (tx) => {
    const stack = await tx.applicationStack.findUniqueOrThrow({
      where: { id: params.stackId },
    })

    if (
      stack.status === "QUEUED" ||
      stack.status === "BUILDING" ||
      stack.status === "DEPLOYING"
    ) {
      throw new Error("A deployment is already in progress for this stack")
    }

    const newDeployment = await tx.applicationDeployment.create({
      data: {
        stackId: params.stackId,
        organizationId: stack.organizationId,
        status: "QUEUED",
        triggerType: params.triggerType ?? "MANUAL",
        commitSha: null,
        commitMessage: null,
        commitAuthor: null,
        sourceUrl: stack.publicSourceUrl,
        sourceRef: stack.publicSourceRef,
        branchName: stack.branchName,
        attempt: previousAttempts + 1,
      },
    })

    await tx.applicationDeployEvent.create({
      data: {
        deploymentId: newDeployment.id,
        type: "QUEUED",
        message: "Deployment queued",
        metadataJson: Prisma.JsonNull,
      },
    })

    await tx.applicationDeploymentLog.create({
      data: {
        deploymentId: newDeployment.id,
        scope: "build",
        status: "QUEUED",
        message: "Deployment queued and awaiting build worker.",
      },
    })

    await tx.applicationStack.update({
      where: { id: params.stackId },
      data: { status: "QUEUED" },
    })

    return newDeployment
  })

  return { deploymentId: deployment.id, status: "QUEUED" as const }
}
