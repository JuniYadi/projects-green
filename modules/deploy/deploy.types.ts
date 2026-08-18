export type DeployStep = "source" | "connect" | "detect" | "review" | "deploy"

export type DeploySourceType = "github" | "template" | "public"

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
  installationId: number
}

export type Branch = {
  id: string
  repoId: string
  name: string
}

export type DetectionStatus =
  | "success"
  | "blocked"
  | "unsupported"
  | "low_confidence"
  | "failed"
  | "partial"

export type DetectionEvidence = {
  type: string
  value: string
  detail?: string
}

export type DetectionResult = {
  language: string | null
  framework: string | null
  frameworkVersion?: string | null
  dockerfileDetected: boolean
  buildCommand: string | null
  confidence: number
  status: DetectionStatus
  decisionMessage?: string
  evidence?: DetectionEvidence[]
  inspectionLogId?: string
  primaryEngine?: string | null
  primaryEngineVersion?: string | null
  secondaryEngine?: string | null
  secondaryEngineVersion?: string | null
  defaultPort?: number | null
}

export type EnvVarType =
  | "plain"
  | "secret_ref"
  | "secret_shared_ref"
  /** Legacy value accepted while older deploy payloads are migrated. */
  | "secret"

export type SharedSecretServiceType = "MYSQL" | "POSTGRESQL" | "REDIS"

export type SharedSecretOption = {
  id: string
  label: string
  serviceType: SharedSecretServiceType
  serviceCredentialId: string
  vaultPath: string
  vaultKey: string
  description?: string
}

export type EnvVar = {
  id: string
  key: string
  value: string
  type?: EnvVarType
  scope?: "all" | "build" | "runtime"
  lastUpdatedAt?: string
  isStoredSecret?: boolean
  masked?: boolean
  source?: "vault" | "managed_service"
  serviceCredentialId?: string
  vaultPath?: string
  vaultKey?: string
  version?: number
  referenceLabel?: string
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
  status: Exclude<DeployStatus, "idle" | "failed">
}

export type DeploySourceState = {
  sourceType: DeploySourceType
  appName: string
  templateId?: DeployTemplateId
  ownerId: string
  repositoryId: string
  branchName: string
  rootDirectory: string
  publicSourceUrl?: string
  publicSourceRef?: string
}
export type DeployBuildState = {
  language: string
  framework: string
  frameworkVersion?: string
  buildCommand: string
  useDockerfile: boolean
  primaryEngine?: string
  primaryEngineVersion?: string
  secondaryEngine?: string
  secondaryEngineVersion?: string
  defaultPort?: number
}

export type DeployEnvironmentState = {
  useGeneratedSubdomain: boolean
  customDomain: string
  envVars: EnvVar[]
  resourcePlanId: ResourcePlanId
  billingMode?: "PAYG" | "PACKAGE"
  paygBufferHours?: number
  cpu?: number
  memory?: number
}

export type DeployMonitorState = {
  deployId?: string
  status: DeployStatus
  logScope: DeployLogScope
  attempt: number
  tick: number
  isActive: boolean
  shouldFail: boolean
  failureReason: string | null
  liveDomain?: string
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
