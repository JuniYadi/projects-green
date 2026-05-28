export type DeployStep = "source" | "build" | "environment" | "monitor"

export type DeploySourceType = "github" | "template"

export type DeployTemplateId =
  | "wordpress"
  | "n8n"
  | "openclaw"
  | "ghost"
  | "strapi"
  | "directus"
  | "payload"
  | "pocketbase"
  | "umami"
  | "plausible"

export type DeployTemplate = {
  id: DeployTemplateId
  name: string
  description: string
  icon?: string
}

export type PaginatedResponse<T> = {
  data: T[]
  hasNextPage: boolean
  nextCursor?: string
}

export type Owner = {
  id: string
  name: string
  avatarUrl: string
}

export type Repository = {
  id: string
  ownerId: string
  name: string
  isPrivate: boolean
  defaultBranch?: string
}

export type Branch = {
  id: string
  repoId: string
  name: string
}

export type DetectionStatus = "success" | "low_confidence" | "failed"

export type DetectionResult = {
  language: string | null
  framework: string | null
  dockerfileDetected: boolean
  buildCommand: string | null
  confidence: number
  status: DetectionStatus
}

export type EnvVar = {
  id: string
  key: string
  value: string
  type?: "plain" | "secret"
  scope?: "all" | "build" | "runtime"
  lastUpdatedAt?: string
  isStoredSecret?: boolean
  masked?: boolean
}

export type ResourcePlanId = "starter" | "pro" | "payg"

export type ResourcePlan = {
  id: ResourcePlanId
  name: string
  description: string
}

export type DeployStatus =
  | "idle"
  | "queued"
  | "building"
  | "deploying"
  | "running"
  | "failed"

export type DeployLogScope = "all" | "build" | "runtime"

export type DeployLogLine = {
  id: string
  scope: Exclude<DeployLogScope, "all">
  status: Exclude<DeployStatus, "idle">
  message: string
}

export type DeployTimelineItem = {
  id: string
  label: string
  status: Exclude<DeployStatus, "idle" | "running" | "failed">
}

export type DeploySourceState = {
  sourceType: DeploySourceType
  templateId?: DeployTemplateId
  ownerId: string
  repositoryId: string
  branchName: string
  rootDirectory: string
}

export type DeployBuildState = {
  language: string
  framework: string
  buildCommand: string
  useDockerfile: boolean
}

export type DeployEnvironmentState = {
  useGeneratedSubdomain: boolean
  customDomain: string
  envVars: EnvVar[]
  resourcePlanId: ResourcePlanId
  cpu?: number
  memory?: number
}

export type DeployMonitorState = {
  status: DeployStatus
  logScope: DeployLogScope
  attempt: number
  tick: number
  isActive: boolean
  shouldFail: boolean
  failureReason: string | null
}

export type DeployWizardState = {
  step: DeployStep
  source: DeploySourceState
  detectionResult: DetectionResult | null
  build: DeployBuildState
  environment: DeployEnvironmentState
  monitor: DeployMonitorState
}

export type PersistedDeployWizardState = {
  version: number
  state: DeployWizardState
}
