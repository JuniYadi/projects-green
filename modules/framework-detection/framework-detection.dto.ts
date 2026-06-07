import type { Prisma } from "@prisma/client"

import type {
  DetectionDecision,
  DetectionResult,
  DetectedFramework,
  RequiredDependency,
  DetectionEvidence,
} from "@/modules/framework-detection/framework-detection.types"

// --- API Response DTOs ---

export type DetectedFrameworkDTO = {
  id: string
  name: string
  ecosystem: string
  confidence: number
  reasons: string[]
}

export type RequiredDependencyDTO = {
  id: string
  kind: "runtime" | "toolchain"
  requiredFor: "app_runtime" | "asset_build" | "build_pipeline"
  confidence: number
  reason: string
}

export type DetectionEvidenceDTO = {
  type: string
  value: string
  detail?: string
}

export type DetectionDecisionDTO = {
  status: DetectionDecision["status"]
  message: string
  isLaunchable: boolean
}

export type DetectionResultDTO = {
  primaryFramework: DetectedFrameworkDTO | null
  requiredDependencies: RequiredDependencyDTO[]
  alternatives: DetectedFrameworkDTO[]
  confidence: number
  decision: DetectionDecisionDTO
  evidence: DetectionEvidenceDTO[]
  warnings: string[]
  source: {
    repoUrl: string
    ref?: string
    subdir?: string
  }
  enforcedRuntimes?: Array<{ runtimeId: string; version: string }>
  inspectionLogId?: string
}

// --- Mapping Functions ---

export function toDetectedFrameworkDTO(
  framework: DetectedFramework
): DetectedFrameworkDTO {
  return {
    id: framework.id,
    name: framework.name,
    ecosystem: framework.ecosystem,
    confidence: framework.confidence,
    reasons: framework.reasons,
  }
}

export function toRequiredDependencyDTO(
  dependency: RequiredDependency
): RequiredDependencyDTO {
  return {
    id: dependency.id,
    kind: dependency.kind,
    requiredFor: dependency.requiredFor,
    confidence: dependency.confidence,
    reason: dependency.reason,
  }
}

export function toDetectionEvidenceDTO(
  evidence: DetectionEvidence
): DetectionEvidenceDTO {
  return {
    type: evidence.type,
    value: evidence.value,
    detail: evidence.detail,
  }
}

export function toDetectionResultDTO(
  result: DetectionResult
): DetectionResultDTO {
  return {
    primaryFramework: result.primaryFramework
      ? toDetectedFrameworkDTO(result.primaryFramework)
      : null,
    requiredDependencies: result.requiredDependencies.map(
      toRequiredDependencyDTO
    ),
    alternatives: result.alternatives.map(toDetectedFrameworkDTO),
    confidence: result.confidence,
    decision: {
      status: result.decision.status,
      message: result.decision.message,
      isLaunchable: result.decision.isLaunchable,
    },
    evidence: result.evidence.map(toDetectionEvidenceDTO),
    warnings: result.warnings,
    source: result.source,
  }
}

// --- Inspection Log DTO ---

export type InspectionLogDTO = {
  id: string
  repoUrl: string
  ref: string | null
  detectedFramework: string | null
  confidence: number | null
  enforcedRuntimes: Array<{ runtimeId: string; version: string }> | null
  reasoning: string[]
  warnings: string[]
  durationMs: number | null
  status: string
  blockedByRuleId: string | null
  errorMessage: string | null
  createdAt: Date
}

export function toInspectionLogDTO(
  log: Prisma.InspectionLogGetPayload<object>
): InspectionLogDTO {
  return {
    id: log.id,
    repoUrl: log.repoUrl,
    ref: log.ref,
    detectedFramework: log.detectedFramework,
    confidence: log.confidence,
    enforcedRuntimes: log.enforcedRuntimes as Array<{
      runtimeId: string
      version: string
    }> | null,
    reasoning: log.reasoning,
    warnings: log.warnings,
    durationMs: log.durationMs,
    status: log.status,
    blockedByRuleId: log.blockedByRuleId,
    errorMessage: log.errorMessage,
    createdAt: log.createdAt,
  }
}

// --- Runtime Mapping DTO ---

export type RuntimeMappingDTO = {
  id: string
  frameworkId: string
  frameworkVersion: string | null
  runtimeId: string
  runtimeVersion: string
  buildVersion: string | null
  isActive: boolean
  priority: number
}

export function toRuntimeMappingDTO(
  mapping: Prisma.RuntimeMappingGetPayload<object>
): RuntimeMappingDTO {
  return {
    id: mapping.id,
    frameworkId: mapping.frameworkId,
    frameworkVersion: mapping.frameworkVersion,
    runtimeId: mapping.runtimeId,
    runtimeVersion: mapping.runtimeVersion,
    buildVersion: mapping.buildVersion,
    isActive: mapping.isActive,
    priority: mapping.priority,
  }
}

// --- Detector Rule DTO ---

export type DetectorRuleDTO = {
  id: string
  name: string
  description: string | null
  patternJson: unknown
  implicationsJson: unknown
  confidenceWeight: number
  isActive: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

export function toDetectorRuleDTO(
  rule: Prisma.DetectorRuleGetPayload<object>
): DetectorRuleDTO {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    patternJson: rule.patternJson,
    implicationsJson: rule.implicationsJson,
    confidenceWeight: rule.confidenceWeight,
    isActive: rule.isActive,
    priority: rule.priority,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  }
}
