import type { AiDeploymentSession } from "@prisma/client"

import {
  toAiDeploymentSessionDTO,
  type AiDeploymentSessionDTO,
} from "@/modules/deploy/ai-deployment-session.dto"
import {
  toDeploymentPlanDTO,
  type DeploymentPlanDTO,
} from "@/modules/deploy/deployment-plan.dto"
import {
  toDetectionResultDTO,
  type DetectionResultDTO,
} from "@/modules/framework-detection/framework-detection.dto"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

export const AI_MANUAL_OVERRIDE_FIELDS = [
  "language",
  "framework",
  "runtime",
  "packageManager",
  "buildCommand",
  "startCommand",
  "port",
  "dockerfile",
] as const

export type AiManualOverrideField = (typeof AI_MANUAL_OVERRIDE_FIELDS)[number]

export type AiSourceInspectionStatus =
  | "plan_ready"
  | "blocked"
  | "manual_override_required"
  | "not_supported"

export type AiSourceInspectionReasonCode =
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

export type AiSourceInspectionRequestDTO = {
  sourceUrl: string
  ref?: string
  subdir?: string
  sessionId?: string
}

export type AiSourceInspectionSourceDTO = {
  url: string
  host: "github.com"
  owner: string
  repo: string
  ref: string | null
  subdir: string | null
}

export type AiSourceInspectionAccessState =
  | "public"
  | "credential"
  | "connection_required"
  | "denied"

export type AiSourceInspectionAccessDTO = {
  state: AiSourceInspectionAccessState
  displayLabel: string | null
}

export type AiSourceInspectionManualOverrideDTO = {
  required: true
  reasonCode: AiSourceInspectionReasonCode
  message: string
  fields: AiManualOverrideField[]
  evidenceReferences: string[]
}

export type AiSourceInspectionDTO = {
  status: AiSourceInspectionStatus
  source: AiSourceInspectionSourceDTO | null
  access: AiSourceInspectionAccessDTO | null
  detection: DetectionResultDTO | null
  plan: DeploymentPlanDTO | null
  manualOverride: AiSourceInspectionManualOverrideDTO | null
  evidenceReferences: string[]
  session: AiDeploymentSessionDTO | null
}

export type AiSourceInspectionResult = {
  status: AiSourceInspectionStatus
  source: AiSourceInspectionSourceDTO | null
  access: AiSourceInspectionAccessDTO | null
  detection: DetectionResult | null
  plan: DeploymentPlanDTO | null
  manualOverride: AiSourceInspectionManualOverrideDTO | null
  evidenceReferences: string[]
  session: AiDeploymentSession | null
}

export function toAiSourceInspectionDTO(
  result: AiSourceInspectionResult
): AiSourceInspectionDTO {
  const session = result.session

  return {
    status: result.status,
    source: result.source,
    access: result.access,
    detection: result.detection ? toDetectionResultDTO(result.detection) : null,
    plan: result.plan ?? (session ? toDeploymentPlanDTO(session.plan) : null),
    manualOverride: result.manualOverride,
    evidenceReferences: result.evidenceReferences,
    session: session ? toAiDeploymentSessionDTO(session) : null,
  }
}
