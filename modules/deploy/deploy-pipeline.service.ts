import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { syncJenkinsPipeline } from "@/modules/jenkins/jenkins-sync.service"

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
  repositoryConnectionId?: string | null
  branchName: string
  rootDirectory: string
  framework?: string | null
  buildCommand?: string | null
  dockerfileDetected: boolean
  resourcePlanId?: string | null
  billingMode?: "PAYG" | "PACKAGE"
  hourlyCost?: string | number | null
  cpu?: number | null
  memory?: number | null
  customDomain?: string | null
  subdomain?: string | null
  envVars?: unknown[]
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
  env: "dev" | "prod" = "dev"
): Promise<void> {
  try {
    // Need repositoryConnectionId to get installation info
    if (!stack.repositoryConnectionId) {
      console.log(`[jenkins-sync] Skipping — no repository connection for ${stack.slug}`)
      return
    }

    // Look up connection and installation
    const connection = await prisma.githubRepositoryConnection.findUnique({
      where: { id: stack.repositoryConnectionId },
      include: { installation: true },
    })

    if (!connection) {
      console.log(`[jenkins-sync] Skipping — connection not found for ${stack.slug}`)
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
      env,
    })

    console.log(
      `[jenkins-sync] ${result.action} pipeline for ${stack.slug}: ${result.filePath}`
    )
  } catch (error) {
    // Non-blocking — log but don't fail stack creation
    console.error(`[jenkins-sync] Failed to sync pipeline for ${stack.slug}:`, error)
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

    const data = {
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      sourceType: "GITHUB" as const,
      repositoryConnectionId: input.repositoryConnectionId ?? null,
      branchName: input.branchName,
      rootDirectory: input.rootDirectory,
      framework: input.framework ?? null,
      buildCommand: input.buildCommand ?? null,
      dockerfileDetected: input.dockerfileDetected,
      resourcePlanId: input.resourcePlanId ?? null,
      billingMode: input.billingMode ?? "PAYG",
      hourlyCost,
      cpu: input.cpu ?? null,
      memory: input.memory ?? null,
      customDomain: input.customDomain ?? null,
      subdomain: input.subdomain ?? null,
      envVarsJson,
    }

    if (existing) {
      return tx.applicationStack.update({
        where: { id: existing.id },
        data,
      })
    }

    return tx.applicationStack.create({ data })
  })

  // Non-blocking: sync Jenkins pipeline after stack is created/updated
  // Determine env from slug (e.g., "app-myapp-prod" → "prod", default "dev")
  const env = input.slug.endsWith("-prod") ? "prod" : "dev"
  syncJenkinsPipelineForStack(input, env).catch(() => {
    // Already logged in the function
  })

  return stack
}

export async function triggerDeploy(params: {
  stackId: string
  triggerType?: "MANUAL" | "GITHUB" | "TEMPLATE"
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

    if (stack.status === "QUEUED" || stack.status === "BUILDING" || stack.status === "DEPLOYING") {
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
