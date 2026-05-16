export type DetectionEcosystem =
  | "node"
  | "php"
  | "python"
  | "ruby"
  | "java"
  | "go"
  | "rust"
  | "unknown"

export type RuntimeId =
  | "node"
  | "php"
  | "python"
  | "ruby"
  | "java"
  | "go"
  | "rust"

export type DetectedFramework = {
  id: string
  name: string
  ecosystem: DetectionEcosystem
  confidence: number
  reasons: string[]
}

export type RequiredDependency = {
  id: RuntimeId
  kind: "runtime" | "toolchain"
  requiredFor: "app_runtime" | "asset_build" | "build_pipeline"
  confidence: number
  reason: string
}

export type DetectionEvidence = {
  type: "file" | "lockfile" | "dependency" | "script" | "ai"
  value: string
  detail?: string
}

export type DetectionResult = {
  primaryFramework: DetectedFramework | null
  requiredDependencies: RequiredDependency[]
  alternatives: DetectedFramework[]
  confidence: number
  evidence: DetectionEvidence[]
  warnings: string[]
  source: {
    repoUrl: string
    ref?: string
    subdir?: string
  }
}

export type FrameworkDetectionInput = {
  repoUrl: string
  ref?: string
  subdir?: string
  maxScanFiles?: number
  maxDepth?: number
  cloneTimeoutMs?: number
  scanTimeoutMs?: number
}
