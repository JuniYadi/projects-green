export const AI_DETECTION_TRACE_VERSION = 1 as const

export type ProviderDiagnosticCategory =
  | "configuration"
  | "schema"
  | "provider"
  | "transient_provider"
  | "network"

export type ProviderDiagnostics = {
  model: string
  baseUrlHost: string
  httpStatus?: number
  requestId?: string
  category: ProviderDiagnosticCategory
}

export type AiDetectionTraceTerminalStage =
  | "provider"
  | "tool"
  | "output"
  | "completed"

export type AiDetectionToolTrace = {
  name: "list_repo_files" | "read_repo_file"
  inputSummary: {
    requestedPath?: string
  }
  outcome: "completed" | "failed"
  durationMs: number
  listedFileCount?: number
  errorCategory?: "tool_failure"
}

export type AiDetectionTrace = {
  version: typeof AI_DETECTION_TRACE_VERSION
  terminalStage: AiDetectionTraceTerminalStage
  elapsedMs: number
  model: string
  baseUrlHost: string
  tools: AiDetectionToolTrace[]
}
