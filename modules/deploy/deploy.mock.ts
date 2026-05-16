import {
  DEFAULT_BUILD_STATE,
  DEFAULT_MONITOR_STATE,
  DEFAULT_SOURCE_STATE,
} from "@/modules/deploy/deploy.constants"
import type {
  Branch,
  DeployLogLine,
  DeployTimelineItem,
  DetectionResult,
  Owner,
  PaginatedResponse,
  Repository,
  ResourcePlan,
} from "@/modules/deploy/deploy.types"

export const MOCK_OWNERS: Owner[] = [
  {
    id: "owner-pfn",
    name: "pfn-labs",
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  },
  {
    id: "owner-acme",
    name: "acme-inc",
    avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
  },
  {
    id: "owner-jane",
    name: "jane-doe",
    avatarUrl: "https://avatars.githubusercontent.com/u/3?v=4",
  },
]

export const MOCK_REPOSITORIES: Repository[] = [
  {
    id: "repo-console-next",
    ownerId: "owner-pfn",
    name: "console-next-app",
    isPrivate: true,
  },
  {
    id: "repo-api-monolith",
    ownerId: "owner-pfn",
    name: "platform-api",
    isPrivate: true,
  },
  {
    id: "repo-storefront",
    ownerId: "owner-acme",
    name: "storefront",
    isPrivate: false,
  },
  {
    id: "repo-failing-build",
    ownerId: "owner-acme",
    name: "legacy-worker",
    isPrivate: true,
  },
  {
    id: "repo-portfolio",
    ownerId: "owner-jane",
    name: "portfolio-site",
    isPrivate: false,
  },
]

export const MOCK_BRANCHES: Branch[] = [
  { id: "branch-1", repoId: "repo-console-next", name: "main" },
  { id: "branch-2", repoId: "repo-console-next", name: "staging" },
  { id: "branch-3", repoId: "repo-api-monolith", name: "master" },
  { id: "branch-4", repoId: "repo-api-monolith", name: "develop" },
  { id: "branch-5", repoId: "repo-storefront", name: "main" },
  { id: "branch-6", repoId: "repo-storefront", name: "preview" },
  { id: "branch-7", repoId: "repo-failing-build", name: "main" },
  { id: "branch-8", repoId: "repo-portfolio", name: "production" },
]

export const MOCK_DETECTION_BY_REPOSITORY_ID: Record<string, DetectionResult> =
  {
    "repo-console-next": {
      language: "Node.js",
      framework: "Next.js",
      dockerfileDetected: false,
      buildCommand: "npm run build",
      confidence: 92,
      status: "success",
    },
    "repo-api-monolith": {
      language: "Node.js",
      framework: "Express",
      dockerfileDetected: true,
      buildCommand: "npm run build",
      confidence: 68,
      status: "low_confidence",
    },
    "repo-storefront": {
      language: "Node.js",
      framework: "React",
      dockerfileDetected: false,
      buildCommand: "npm run build",
      confidence: 84,
      status: "success",
    },
    "repo-failing-build": {
      language: null,
      framework: null,
      dockerfileDetected: false,
      buildCommand: null,
      confidence: 0,
      status: "failed",
    },
    "repo-portfolio": {
      language: "Node.js",
      framework: "Next.js",
      dockerfileDetected: false,
      buildCommand: "npm run build",
      confidence: 49,
      status: "low_confidence",
    },
  }

export const RESOURCE_PLANS: ResourcePlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Good for static sites and small APIs.",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Good for production apps with steady traffic.",
  },
]

export const DEPLOY_TIMELINE: DeployTimelineItem[] = [
  { id: "prep", label: "Preparing", status: "queued" },
  { id: "build", label: "Building", status: "building" },
  { id: "deploy", label: "Deploying", status: "deploying" },
]

export const DEPLOY_LOG_LINES: DeployLogLine[] = [
  {
    id: "log-1",
    scope: "build",
    status: "queued",
    message: "Queued: reserving build worker.",
  },
  {
    id: "log-2",
    scope: "build",
    status: "building",
    message: "Installing dependencies from lockfile.",
  },
  {
    id: "log-3",
    scope: "build",
    status: "building",
    message: "Running build command.",
  },
  {
    id: "log-4",
    scope: "runtime",
    status: "deploying",
    message: "Creating container image and release.",
  },
  {
    id: "log-5",
    scope: "runtime",
    status: "deploying",
    message: "Warming up runtime checks.",
  },
]

export const FAILURE_REASON =
  "Build failed: package lockfile is out of sync with package.json."

const filterByText = <T extends { name: string }>(items: T[], search: string) => {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return items
  }

  return items.filter((item) => {
    return item.name.toLowerCase().includes(normalizedSearch)
  })
}

const paginate = <T>(
  items: T[],
  cursor: string | undefined,
  pageSize = 8
): PaginatedResponse<T> => {
  const start = cursor ? Number(cursor) : 0
  const safeStart = Number.isNaN(start) ? 0 : start
  const end = safeStart + pageSize

  return {
    data: items.slice(safeStart, end),
    hasNextPage: end < items.length,
    nextCursor: end < items.length ? String(end) : undefined,
  }
}

export const queryOwners = (
  search: string,
  cursor?: string
): PaginatedResponse<Owner> => {
  return paginate(filterByText(MOCK_OWNERS, search), cursor)
}

export const queryRepositories = (
  ownerId: string,
  search: string,
  cursor?: string
): PaginatedResponse<Repository> => {
  const inOwner = MOCK_REPOSITORIES.filter((repo) => repo.ownerId === ownerId)
  const filtered = filterByText(inOwner, search)
  return paginate(filtered, cursor)
}

export const getRepositoryBranches = (repoId: string): Branch[] => {
  return MOCK_BRANCHES.filter((branch) => branch.repoId === repoId)
}

export const getDefaultBranchName = (repoId: string): string => {
  const branches = getRepositoryBranches(repoId)
  if (branches.length === 0) {
    return ""
  }

  const main = branches.find((branch) => branch.name === "main")
  if (main) {
    return main.name
  }

  const master = branches.find((branch) => branch.name === "master")
  if (master) {
    return master.name
  }

  return branches[0]?.name ?? ""
}

export const getDetectionForRepository = (
  repositoryId: string
): DetectionResult => {
  return (
    MOCK_DETECTION_BY_REPOSITORY_ID[repositoryId] ?? {
      language: null,
      framework: null,
      dockerfileDetected: false,
      buildCommand: null,
      confidence: 0,
      status: "failed",
    }
  )
}

export const shouldDeploymentFailForRepository = (
  repositoryId: string
): boolean => {
  return repositoryId === "repo-failing-build"
}

export const buildInitialBuildState = (repositoryId: string) => {
  const detection = getDetectionForRepository(repositoryId)

  return {
    ...DEFAULT_BUILD_STATE,
    language: detection.language ?? "",
    framework: detection.framework ?? "",
    buildCommand: detection.buildCommand ?? "",
  }
}

export const buildInitialSourceState = () => {
  return { ...DEFAULT_SOURCE_STATE }
}

export const buildInitialMonitorState = (shouldFail: boolean) => {
  return {
    ...DEFAULT_MONITOR_STATE,
    shouldFail,
    failureReason: shouldFail ? FAILURE_REASON : null,
  }
}
