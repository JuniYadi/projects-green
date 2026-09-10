import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { syncStackConfiguration } from "./sync-stack.service"
import type { AppTemplateBlueprint } from "./blueprint/app-template-blueprint.schema"

export interface TemplateInstallationItem {
  id: string
  name: string
  slug: string
  organizationId: string
  status: string
  currentDeploymentType: "deployment" | "statefulset"
  targetDeploymentType: "deployment" | "statefulset"
  installedVersion: string
  latestVersion: string
  isAligned: boolean
  lastDeployedAt: Date | null
  lastDeployStatus: string | null
  createdAt: Date
  updatedAt: Date
  latestDeployment: {
    id: string
    status: string
    attempt: number
    commitSha: string | null
    failureReason: string | null
    startedAt: Date
  } | null
}

export interface ListTemplateInstallationsResult {
  template: {
    id: string
    slug: string
    name: string
    targetDeploymentType: "deployment" | "statefulset"
    version: string
  }
  totalInstallations: number
  alignedInstallations: number
  outdatedInstallations: number
  installations: TemplateInstallationItem[]
}

export async function listTemplateInstallations(
  templateId: string
): Promise<ListTemplateInstallationsResult> {
  const template = await prisma.appTemplate.findFirst({
    where: {
      OR: [{ id: templateId }, { slug: templateId }],
    },
  })

  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }

  const bp = template.blueprintJson as unknown as AppTemplateBlueprint | null
  const targetDeploymentType = bp?.runtime?.deploymentType ?? "deployment"

  const stacks = await prisma.applicationStack.findMany({
    where: {
      OR: [
        { templateId: template.id },
        { templateId: template.slug },
        { metadataJson: { path: ["templateId"], equals: template.id } },
        { metadataJson: { path: ["templateId"], equals: template.slug } },
      ],
    },
    include: {
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const installations: TemplateInstallationItem[] = stacks.map((stack) => {
    const meta = (stack.metadataJson as Record<string, unknown>) ?? {}
    const currentDeploymentType =
      meta.deploymentType === "statefulset" ||
      meta.deploymentType === "deployment"
        ? meta.deploymentType
        : "deployment"
    const installedVersion =
      (meta.templateVersion as string | undefined) ?? "1.0.0"
    const latestVersion = template.version ?? "1.0.0"
    const isAligned =
      currentDeploymentType === targetDeploymentType &&
      installedVersion === latestVersion
    const latestDeployment = stack.deployments[0] ?? null
    return {
      id: stack.id,
      name: stack.name,
      slug: stack.slug,
      organizationId: stack.organizationId,
      status: stack.status,
      currentDeploymentType,
      targetDeploymentType,
      isAligned,
      installedVersion,
      latestVersion,
      lastDeployedAt: stack.lastDeployedAt,
      lastDeployStatus: stack.lastDeployStatus,
      createdAt: stack.createdAt,
      updatedAt: stack.updatedAt,
      latestDeployment: latestDeployment
        ? {
            id: latestDeployment.id,
            status: latestDeployment.status,
            attempt: latestDeployment.attempt,
            commitSha: latestDeployment.commitSha,
            failureReason: latestDeployment.failureReason,
            startedAt: latestDeployment.startedAt,
          }
        : null,
    }
  })

  const alignedInstallations = installations.filter((i) => i.isAligned).length
  const outdatedInstallations = installations.length - alignedInstallations

  return {
    template: {
      id: template.id,
      slug: template.slug,
      name: template.name,
      targetDeploymentType,
      version: template.version ?? "1.0.0",
    },
    totalInstallations: installations.length,
    alignedInstallations,
    outdatedInstallations,
    installations,
  }
}

export async function syncStackFromParentTemplate(params: {
  templateId: string
  stackId: string
  preloadedTemplate?: {
    id: string
    slug: string
    blueprintJson: unknown
    version?: string | null
  } | null
}): Promise<{
  ok: boolean
  stackId: string
  slug: string
  commitSha: string | null
  message: string
}> {
  const template =
    params.preloadedTemplate ??
    (await prisma.appTemplate.findFirst({
      where: {
        OR: [{ id: params.templateId }, { slug: params.templateId }],
      },
    }))

  if (!template) {
    throw new Error(`Template not found: ${params.templateId}`)
  }

  const stack = await prisma.applicationStack.findUnique({
    where: { id: params.stackId },
  })

  if (!stack) {
    throw new Error(`Application stack not found: ${params.stackId}`)
  }

  const bp = template.blueprintJson as unknown as AppTemplateBlueprint | null
  const meta = (stack.metadataJson as Record<string, unknown>) ?? {}

  // 1. Architecture merge: Template updates controller kind & ports
  const updatedMetadata: Record<string, unknown> = {
    ...meta,
    templateId: template.id,
    templateVersion: template.version ?? "1.0.0",
  }

  if (bp?.runtime) {
    if (bp.runtime.deploymentType) {
      updatedMetadata.deploymentType = bp.runtime.deploymentType
    }
    if (bp.runtime.additionalPorts) {
      updatedMetadata.additionalPorts = bp.runtime.additionalPorts
    }
    if (bp.runtime.defaultPort) {
      updatedMetadata.defaultPort = bp.runtime.defaultPort
    }
    if (bp.runtime.healthCheckPath !== undefined) {
      updatedMetadata.healthCheckPath =
        bp.runtime.healthCheckPath?.trim() || null
    } else {
      updatedMetadata.healthCheckPath = null
    }
    if (bp.runtime.image && !meta.imageRepository) {
      updatedMetadata.imageRepository = bp.runtime.image
    }
    if (bp.runtime.livenessProbe !== undefined) {
      updatedMetadata.livenessProbe = bp.runtime.livenessProbe
    } else {
      delete updatedMetadata.livenessProbe
    }
    if (bp.runtime.readinessProbe !== undefined) {
      updatedMetadata.readinessProbe = bp.runtime.readinessProbe
    } else {
      delete updatedMetadata.readinessProbe
    }
    if (bp.runtime.startupProbe !== undefined) {
      updatedMetadata.startupProbe = bp.runtime.startupProbe
    } else {
      delete updatedMetadata.startupProbe
    }
  }
  if (bp?.scaling) {
    updatedMetadata.scaling = bp.scaling
  }
  // 2. Env vars merge: User overrides win, template adds missing defaults
  const userEnvs = Array.isArray(stack.envVarsJson)
    ? (stack.envVarsJson as Array<Record<string, unknown>>)
    : []
  const userEnvKeys = new Set(
    userEnvs
      .map((e) => (typeof e?.key === "string" ? e.key : null))
      .filter((k): k is string => Boolean(k))
  )

  const newTemplateEnvs: Array<Record<string, unknown>> = []
  if (Array.isArray(bp?.envSchema)) {
    for (const schemaVar of bp.envSchema) {
      if (
        schemaVar.defaultValue !== undefined &&
        schemaVar.defaultValue !== null &&
        schemaVar.defaultValue !== "" &&
        !userEnvKeys.has(schemaVar.key)
      ) {
        newTemplateEnvs.push({
          key: schemaVar.key,
          value: String(schemaVar.defaultValue),
          type: schemaVar.isSecret ? "secret" : "plain",
        })
      }
    }
  }

  const mergedEnvVars = [...userEnvs, ...newTemplateEnvs]

  // 3. Update stack (cpu, memory, domains, billingMode remain completely untouched)
  await prisma.applicationStack.update({
    where: { id: stack.id },
    data: {
      templateId: template.id,
      metadataJson: updatedMetadata as Prisma.InputJsonValue,
      envVarsJson: mergedEnvVars as Prisma.InputJsonValue,
    },
  })

  // 4. Trigger GitOps sync
  const syncRes = await syncStackConfiguration({
    slug: stack.slug,
    organizationId: stack.organizationId,
  })

  return {
    ok: syncRes.ok,
    stackId: stack.id,
    slug: stack.slug,
    commitSha: syncRes.commitSha,
    message: syncRes.message,
  }
}

export async function syncMultipleStacksFromParentTemplate(params: {
  templateId: string
  stackIds: string[]
}): Promise<{
  total: number
  succeeded: number
  failed: number
  results: Array<{
    stackId: string
    slug?: string
    ok: boolean
    commitSha?: string | null
    error?: string
  }>
}> {
  const template = await prisma.appTemplate.findFirst({
    where: {
      OR: [{ id: params.templateId }, { slug: params.templateId }],
    },
  })

  if (!template) {
    throw new Error(`Template not found: ${params.templateId}`)
  }

  const results: Array<{
    stackId: string
    slug?: string
    ok: boolean
    commitSha?: string | null
    error?: string
  }> = []

  for (const stackId of params.stackIds) {
    try {
      const res = await syncStackFromParentTemplate({
        templateId: params.templateId,
        stackId,
        preloadedTemplate: template,
      })
      results.push({
        stackId,
        slug: res.slug,
        ok: res.ok,
        commitSha: res.commitSha,
      })
    } catch (err) {
      results.push({
        stackId,
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed",
      })
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return {
    total: results.length,
    succeeded,
    failed,
    results,
  }
}
