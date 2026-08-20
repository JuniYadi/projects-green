/**
 * Client-side types for the AI Deploy Feed UI.
 * Mirrors backend DTOs; does not import from modules/deploy/* directly
 * to keep the UI layer independent.
 */

// ─── Source Inspection ───────────────────────────────────────────────────────

export type AiAccessState =
  | "public"
  | "credential"
  | "connection_required"
  | "denied"

export type AiInspectionStatus =
  | "plan_ready"
  | "blocked"
  | "manual_override_required"
  | "not_supported"

export type AiReasonCode =
  | "ACCESS_REQUIRED"
  | "ACCESS_DENIED"
  | "SOURCE_REF_NOT_FOUND"
  | "SOURCE_UNAVAILABLE"
  | "DETECTION_BLOCKED"
  | "DETECTION_UNSUPPORTED"
  | "DETECTION_LOW_CONFIDENCE"
  | "DETECTION_CONFIG_ERROR"
  | "DETECTION_SCHEMA_ERROR"
  | "DETECTION_PROVIDER_ERROR"
  | "DETECTION_TRANSIENT_PROVIDER_ERROR"
  | "NETWORK_ERROR"
  | "DETECTION_FAILED"
  | "PLAN_UNRESOLVED"
  | "PLAN_INVALID"

export type AiSourceDTO = {
  url: string
  host: "github.com"
  owner: string
  repo: string
  ref: string | null
  subdir: string | null
}

export type AiAccessDTO = {
  state: AiAccessState
  displayLabel: string | null
}

export type AiDetectionEvidence = {
  kind: string
  summary: string
  reference: string | null
}

export type AiDetectionDTO = {
  framework: string | null
  frameworkVersion: string | null
  primaryEngine: string | null
  primaryEngineVersion: string | null
  buildCommand: string | null
  startCommand: string | null
  defaultPort: number | null
  useDockerfile: boolean
  dockerfilePath: string | null
  confidence: number | null
  status: string
  evidence: AiDetectionEvidence[]
}

export type AiManualOverrideDTO = {
  required: true
  reasonCode: AiReasonCode
  message: string
  fields: string[]
  evidenceReferences: string[]
}

// ─── Deployment Plan ─────────────────────────────────────────────────────────

export type PlanEnvRequirement = {
  key: string
  required: boolean
  kind: "plain" | "secret" | "generated"
  status: "missing" | "provided" | "generated" | "not_applicable"
  description: string
}

export type PlanUnresolved = {
  key: string
  required: boolean
  description: string
}

export type DeploymentPlanDTO = {
  version: number
  source: {
    kind: "git" | "template"
    url: string | null
    host: string | null
    ref: string | null
    templateId: string | null
  }
  access: {
    state: string
    displayLabel: string | null
  }
  detection: {
    runtime: string | null
    framework: string | null
    version: string | null
    commands: string[]
    port: number | null
    confidence: number | null
    evidence: { kind: string; summary: string; reference: string | null }[]
  }
  configuration: {
    appName: string | null
    branchOrRef: string | null
    environment: "production" | "staging" | "development"
    envRequirements: PlanEnvRequirement[]
  }
  dependencies: {
    key: string
    kind: string
    mode: string
    required: boolean
    status: string
    requiredInputs: string[]
    readinessChecks: string[]
  }[]
  resources: {
    package: string | null
    server: string | null
    region: string | null
    cpu: number | null
    memory: number | null
    storage: number | null
  }
  domain: {
    mode: "auto" | "custom" | "none"
    hostname: string | null
    tls: boolean
  }
  billing: {
    quoteReference: string | null
    currency: string | null
    estimate: number | null
    interval: "hour" | "month" | "year" | null
  }
  execution: {
    ready: boolean
    steps: {
      key: string
      label: string
      status: string
      evidenceReference: string | null
    }[]
  }
  unresolved: PlanUnresolved[]
  provenance: {
    analyzer: string
    sourceReference: string | null
    analyzedAt: string
  }
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type AiSessionStatus =
  | "PENDING"
  | "INSPECTING"
  | "PLAN_READY"
  | "CONFIRMED"
  | "EXECUTING"
  | "DEPLOYED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"

export type AiDeploymentSessionDTO = {
  id: string
  status: AiSessionStatus
  sourceType: string
  stackId: string | null
  deploymentId: string | null
  currentPlanVersion: number
  currentPlanHash: string | null
  plan: DeploymentPlanDTO | null
  blockedReason: string | null
  confirmedAt: string | null
  confirmationPlanHash: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

// ─── Inspection result (returned by /deploy/ai-sessions/inspect) ─────────────

export type AiInspectionDTO = {
  status: AiInspectionStatus
  source: AiSourceDTO | null
  access: AiAccessDTO | null
  detection: AiDetectionDTO | null
  plan: DeploymentPlanDTO | null
  manualOverride: AiManualOverrideDTO | null
  evidenceReferences: string[]
  session: AiDeploymentSessionDTO | null
}

// ─── Feed item types ──────────────────────────────────────────────────────────

export type FeedItemKind =
  | "composing" // initial empty state
  | "inspecting" // spinner: checking source
  | "source_found" // ✓ repo found
  | "access_verified" // ✓ access ok
  | "access_required" // ! need github connect
  | "access_denied" // × access denied
  | "detecting" // ⟳ inspecting repo
  | "detection_success" // ✓ detected framework
  | "detection_low_conf" // ! need manual override
  | "detection_failed" // × detection failed
  | "plan_ready" // ✓ ready to review
  | "deploying" // ⟳ deploying...
  | "build_step" // ⟳ building
  | "deploy_step" // ⟳ deploying to k8s
  | "live" // ✓ app is live
  | "failed" // × deploy failed
  | "not_supported" // ! non-github URL

export type FeedItem = {
  id: string
  kind: FeedItemKind
  timestamp: number
  // core data
  source?: AiSourceDTO
  access?: AiAccessDTO
  detection?: AiDetectionDTO
  plan?: DeploymentPlanDTO
  session?: AiDeploymentSessionDTO
  manualOverride?: AiManualOverrideDTO
  // error info
  errorMessage?: string
  reasonCode?: AiReasonCode
  // deploy progress
  deployId?: string
  deployStatus?: string
  liveUrl?: string
}

// ─── Manual build settings ───────────────────────────────────────────────────

export type ManualBuildSettings = {
  language: string
  framework: string
  runtimeVersion: string
  packageManager: string
  buildCommand: string
  startCommand: string
  port: number
  useDockerfile: boolean
  dockerfilePath: string | null
}

// ─── Resource selection ──────────────────────────────────────────────────────

export type ResourcePlanId = "starter" | "pro" | "payg"

export type ResourceSelection = {
  resourcePlanId: ResourcePlanId
  cpu?: number
  memory?: number
  bufferHours?: number
}
