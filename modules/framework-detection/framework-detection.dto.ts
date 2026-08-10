import type { Prisma } from "@prisma/client"

import type {
  AiDetectionToolTrace,
  AiDetectionTrace,
  ProviderDiagnostics,
} from "@/modules/framework-detection/framework-detection.trace"
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
  frameworkVersion?: string | null
  defaultPort?: number | null
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
    frameworkVersion: result.frameworkVersion ?? null,
    defaultPort: result.defaultPort ?? null,
    enforcedRuntimes: result.enforcedRuntimes,
    inspectionLogId: result.inspectionLogId,
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
  providerDiagnostics: ProviderDiagnostics | null
  trace: AiDetectionTrace | null
  createdAt: Date
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const toSafeToolTrace = (value: unknown): AiDetectionToolTrace | null => {
  if (!isRecord(value) || !isRecord(value.inputSummary)) return null
  if (
    (value.name !== "list_repo_files" && value.name !== "read_repo_file") ||
    (value.outcome !== "completed" && value.outcome !== "failed") ||
    typeof value.durationMs !== "number"
  ) {
    return null
  }
  const requestedPath = value.inputSummary.requestedPath
  const listedFileCount = value.listedFileCount
  const errorCategory = value.errorCategory
  if (
    (requestedPath !== undefined && typeof requestedPath !== "string") ||
    (listedFileCount !== undefined && typeof listedFileCount !== "number") ||
    (errorCategory !== undefined && errorCategory !== "tool_failure")
  ) {
    return null
  }
  return {
    name: value.name,
    inputSummary: {
      ...(typeof requestedPath === "string" ? { requestedPath } : {}),
    },
    outcome: value.outcome,
    durationMs: value.durationMs,
    ...(typeof listedFileCount === "number" ? { listedFileCount } : {}),
    ...(errorCategory === "tool_failure" ? { errorCategory } : {}),
  }
}

const toSafeTrace = (value: unknown): AiDetectionTrace | null => {
  if (!isRecord(value) || !Array.isArray(value.tools)) return null
  if (
    value.version !== 1 ||
    !["provider", "tool", "output", "completed"].includes(
      String(value.terminalStage)
    ) ||
    typeof value.elapsedMs !== "number" ||
    typeof value.model !== "string" ||
    typeof value.baseUrlHost !== "string"
  ) {
    return null
  }
  const tools = value.tools.map(toSafeToolTrace)
  if (tools.some((tool) => tool === null)) return null
  return {
    version: 1,
    terminalStage: value.terminalStage as AiDetectionTrace["terminalStage"],
    elapsedMs: value.elapsedMs,
    model: value.model,
    baseUrlHost: value.baseUrlHost,
    tools: tools as AiDetectionToolTrace[],
  }
}

const toSafeProviderDiagnostics = (
  value: unknown
): ProviderDiagnostics | null => {
  if (!isRecord(value)) return null
  if (
    typeof value.model !== "string" ||
    typeof value.baseUrlHost !== "string" ||
    ![
      "configuration",
      "schema",
      "provider",
      "transient_provider",
      "network",
    ].includes(String(value.category)) ||
    (value.httpStatus !== undefined && typeof value.httpStatus !== "number") ||
    (value.requestId !== undefined && typeof value.requestId !== "string")
  ) {
    return null
  }
  return {
    model: value.model,
    baseUrlHost: value.baseUrlHost,
    category: value.category as ProviderDiagnostics["category"],
    ...(typeof value.httpStatus === "number"
      ? { httpStatus: value.httpStatus }
      : {}),
    ...(typeof value.requestId === "string"
      ? { requestId: value.requestId }
      : {}),
  }
}

export function toInspectionLogDTO(
  log: Prisma.DetectorInspectionLogGetPayload<object>
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
    providerDiagnostics: toSafeProviderDiagnostics(log.providerDiagnostics),
    trace: toSafeTrace(log.aiTrace),
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
  mapping: Prisma.DetectorRuntimeMappingGetPayload<object>
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
