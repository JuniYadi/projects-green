import type {
  DeployStatus,
  DeployWizardState,
  Owner,
  Repository,
} from "@/modules/deploy/deploy.types"

export type GithubRepositoryApiItem = {
  repositoryId: number | string
  name: string
  owner: string
  defaultBranch?: string
  private: boolean
  installationId: string
}

export type GithubRepositoriesResponse = {
  ok: boolean
  items: GithubRepositoryApiItem[]
  owners?: { id: string; name: string; avatarUrl: string | null }[]
  error?: string
}

export type DeploySubmitResponse = {
  ok: boolean
  error?: string
  message?: string
  topupUrl?: string
  data?: { deploymentId: string; status: DeployStatus | string }
}

export const toOwnerOptions = (repositories: Repository[]) => {
  const byOwnerId = new Map<string, Owner>()

  for (const repository of repositories) {
    if (!byOwnerId.has(repository.ownerId)) {
      byOwnerId.set(repository.ownerId, {
        id: repository.ownerId,
        name: repository.ownerId,
        avatarUrl: "",
      })
    }
  }

  return Array.from(byOwnerId.values()).sort((left, right) => {
    return left.name.localeCompare(right.name)
  })
}

export const mapGithubRepository = (
  item: GithubRepositoryApiItem
): Repository => {
  return {
    id: String(item.repositoryId),
    ownerId: item.owner,
    name: item.name,
    isPrivate: item.private,
    defaultBranch: item.defaultBranch || undefined,
    installationId: Number(item.installationId),
  }
}

export const getRequestErrorMessage = (cause: unknown) => {
  if (cause instanceof Error && cause.message) {
    return cause.message
  }

  return "Unable to load repositories from GitHub. Please try again."
}

export const buildRepositoriesUrl = (params: {
  ownerId?: string
  query?: string
  limit?: number
}) => {
  const searchParams = new URLSearchParams()

  if (params.ownerId) {
    searchParams.set("ownerId", params.ownerId)
  }
  if (params.query) {
    searchParams.set("query", params.query)
  }
  searchParams.set("limit", String(params.limit ?? 100))

  return `/api/integrations/github/repositories?${searchParams.toString()}`
}

export const toGeneratedSubdomain = (repositoryName: string | undefined) => {
  const slug = (repositoryName ?? "my-app")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

  return `${slug || "my-app"}.pfn.app`
}

export const generateAppName = (
  templateName: string,
  random: () => number = Math.random
) => {
  const slug = templateName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  const suffix = random().toString(36).substring(2, 6)

  return `${slug}-${suffix}`
}

export const buildDeploySubmitPayload = ({
  state,
  selectedRepository,
  deployWithTemplateDefaults = false,
}: {
  state: DeployWizardState
  selectedRepository: Repository | null
  deployWithTemplateDefaults?: boolean
}) => {
  const isTemplate = state.source.sourceType === "template"
  const isPublic = state.source.sourceType === "public"

  return {
    sourceType: isTemplate
      ? ("TEMPLATE" as const)
      : isPublic
        ? ("PUBLIC" as const)
        : ("GITHUB" as const),
    templateId: isTemplate ? state.source.templateId : undefined,
    repositoryId:
      isTemplate || isPublic ? undefined : state.source.repositoryId,
    name: isTemplate
      ? state.source.appName || "app"
      : isPublic
        ? state.source.appName
        : selectedRepository?.name,
    branchName: isTemplate
      ? "/"
      : isPublic
        ? state.source.publicSourceRef || "/"
        : state.source.branchName,
    rootDirectory: isTemplate
      ? "/"
      : isPublic
        ? state.source.rootDirectory || "/"
        : state.source.rootDirectory || "/",
    publicSourceUrl: isPublic ? state.source.publicSourceUrl : undefined,
    framework: state.build.framework || undefined,
    frameworkVersion: state.build.frameworkVersion || undefined,
    buildCommand: state.build.buildCommand || undefined,
    useDockerfile: state.build.useDockerfile,
    primaryEngine: state.build.primaryEngine || undefined,
    primaryEngineVersion: state.build.primaryEngineVersion || undefined,
    secondaryEngine: state.build.secondaryEngine || undefined,
    secondaryEngineVersion: state.build.secondaryEngineVersion || undefined,
    defaultPort: state.build.defaultPort || undefined,
    resourcePlanId: state.environment.resourcePlanId,
    billingMode: state.environment.billingMode ?? "PAYG",
    cpu: state.environment.cpu,
    memory: state.environment.memory,
    paygBufferHours:
      isTemplate || deployWithTemplateDefaults
        ? undefined
        : state.environment.paygBufferHours,
    subdomain: deployWithTemplateDefaults
      ? `${state.source.appName}.pfn.app`
      : undefined,
    customDomain:
      isTemplate ||
      deployWithTemplateDefaults ||
      state.environment.useGeneratedSubdomain
        ? undefined
        : state.environment.customDomain.trim() || undefined,
    envVars: deployWithTemplateDefaults
      ? []
      : state.environment.envVars.map((item) => ({
          key: item.key,
          value: item.value,
          type: item.type,
          scope: item.scope,
        })),
  }
}

export const getDeploySubmitError = (
  responseOk: boolean,
  payload: DeploySubmitResponse
) => {
  if (responseOk && payload.ok && payload.data) {
    return null
  }

  return (
    payload.message ??
    "Unable to start the deployment. Please review your settings and try again."
  )
}
