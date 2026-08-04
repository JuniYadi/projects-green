import { DEPLOY_TEMPLATES } from "@/modules/deploy/deploy.constants"
import type { DeployTemplateId } from "@/modules/deploy/deploy.types"

export type RecentDeploySourceDTO =
  | {
      sourceType: "github"
      label: string
      ownerId: string
      repositoryId: string
      branchName: string
      rootDirectory: string
    }
  | {
      sourceType: "public"
      label: string
      publicSourceUrl: string
      publicSourceRef: string
      rootDirectory: string
    }
  | {
      sourceType: "template"
      label: string
      templateId: DeployTemplateId
    }

type RecentDeploySourceStack = {
  sourceType: string
  name?: string | null
  branchName?: string | null
  rootDirectory?: string | null
  publicSourceUrl?: string | null
  publicSourceRef?: string | null
  metadataJson?: unknown
  repositoryConnection?: {
    ownerLogin?: string | null
    githubRepositoryId?: bigint | number | string | null
    repoName?: string | null
  } | null
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const publicSourceLabel = (url: string) => {
  try {
    const pathname = new URL(url).pathname.split("/").filter(Boolean)
    return pathname.at(-1) || url
  } catch {
    return url
  }
}
const isTemplateId = (value: unknown): value is DeployTemplateId =>
  typeof value === "string" &&
  DEPLOY_TEMPLATES.some((template) => template.id === value)

export const mapRecentDeploySource = (
  stack: RecentDeploySourceStack
): RecentDeploySourceDTO | null => {
  if (stack.sourceType === "GITHUB") {
    const connection = stack.repositoryConnection
    if (
      !connection ||
      !nonEmpty(connection.ownerLogin) ||
      !nonEmpty(connection.repoName) ||
      connection.githubRepositoryId === null ||
      connection.githubRepositoryId === undefined ||
      !nonEmpty(stack.branchName) ||
      !nonEmpty(stack.rootDirectory)
    ) {
      return null
    }

    const repositoryId = String(connection.githubRepositoryId)
    if (!/^\d+$/.test(repositoryId) || repositoryId === "0") return null

    return {
      sourceType: "github",
      label: `${connection.ownerLogin.trim()}/${connection.repoName.trim()}`,
      ownerId: connection.ownerLogin.trim(),
      repositoryId,
      branchName: stack.branchName.trim(),
      rootDirectory: stack.rootDirectory.trim(),
    }
  }

  if (stack.sourceType === "PUBLIC") {
    if (
      !nonEmpty(stack.publicSourceUrl) ||
      !nonEmpty(stack.publicSourceRef) ||
      !nonEmpty(stack.rootDirectory)
    ) {
      return null
    }

    const publicSourceUrl = stack.publicSourceUrl.trim()
    try {
      const parsed = new URL(publicSourceUrl)
      if (
        parsed.protocol !== "https:" ||
        !["github.com", "gitlab.com"].includes(parsed.hostname.toLowerCase()) ||
        parsed.pathname.split("/").filter(Boolean).length < 2
      ) {
        return null
      }
    } catch {
      return null
    }

    return {
      sourceType: "public",
      label: nonEmpty(stack.name)
        ? stack.name.trim()
        : publicSourceLabel(publicSourceUrl),
      publicSourceUrl: stack.publicSourceUrl,
      publicSourceRef: stack.publicSourceRef,
      rootDirectory: stack.rootDirectory,
    }
  }

  if (stack.sourceType === "TEMPLATE") {
    const templateId = isRecord(stack.metadataJson)
      ? stack.metadataJson.templateId
      : undefined
    if (!isTemplateId(templateId)) return null

    const template = DEPLOY_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return null

    return {
      sourceType: "template",
      label: nonEmpty(stack.name) ? stack.name.trim() : template.name,
      templateId,
    }
  }

  return null
}
