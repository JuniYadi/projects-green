import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { createOpenAI } from "@ai-sdk/openai"
import { generateObject, generateText, Output, stepCountIs, tool } from "ai"
import { z } from "zod"

import { DEFAULT_AI_BASE_URL, getAiProviderConfig } from "@/lib/ai-config"
import {
  AI_DETECTION_TRACE_VERSION,
  type AiDetectionToolTrace,
  type AiDetectionTrace,
  type AiDetectionTraceTerminalStage,
  type ProviderDiagnostics,
} from "@/modules/framework-detection/framework-detection.trace"

import {
  listRepoFiles,
  readRepoFile,
  type ListRepoFilesInput,
  type ReadRepoFileInput,
} from "@/modules/github/github.service"
import type {
  DetectionDecision,
  DetectionErrorCode,
  DetectionEvidence,
  DetectionFailureCode,
  DetectionResult,
  DetectedFramework,
  FrameworkDetectionInput,
  RequiredDependency,
  RuntimeId,
} from "@/modules/framework-detection/framework-detection.types"

const execFileAsync = promisify(execFile)

const DEFAULT_MAX_SCAN_FILES = 5_000
const DEFAULT_MAX_DEPTH = 8
const DEFAULT_CLONE_TIMEOUT_MS = 60_000
const DEFAULT_SCAN_TIMEOUT_MS = 30_000

const JS_LOCKFILES = [
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]

// Default port mapping by framework id — convention-based, not authoritative.
// Fallback is null so the UI prompts the user for manual entry.
const DEFAULT_PORT_MAP: Record<string, number> = {
  nextjs: 3000,
  react: 3000,
  laravel: 80,
  wordpress: 80,
  django: 8000,
  flask: 5000,
}

// --- GitHub API Tool-Calling Detection ---

export type GithubApiDetectionInput = {
  installationId: number
  owner: string
  repo: string
  ref?: string
  subdir?: string
}

export type ToolCallRecord = {
  toolCallId: string
  toolName: string
  input: unknown
  output?: unknown
  error?: string
}

export type AiDecisionResult = {
  decision: AiDecision
  trace?: AiDetectionTrace
  // Kept for injected legacy resolvers; production never persists this shape.
  toolCalls?: ToolCallRecord[]
}

export type GithubApiDetectorDependencies = {
  listFiles?: (
    input: ListRepoFilesInput
  ) => Promise<{ files: string[]; truncated: boolean }>
  readFile?: (
    input: ReadRepoFileInput
  ) => Promise<{ content: string; path: string; sha: string; size: number }>
  resolveWithAiToolCalling?: (
    input: GithubApiDetectionInput,
    fileList: string[],
    detectorRules: DetectorRuleRecord[]
  ) => Promise<AiDecisionResult>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma?: any
}

export type DetectorRuleRecord = {
  id: string
  name: string
  description: string | null
  patternJson: unknown
  implicationsJson: unknown
  confidenceWeight: number
  isActive: boolean
  priority: number
}

export type DetectorRuleSummary = {
  activeCount: number
  impacts: string[]
  blockRuleNames: string[]
  launchRuleNames: string[]
}

export type RuntimeMappingRecord = {
  id: string
  frameworkId: string
  frameworkVersion: string | null
  runtimeId: string
  runtimeVersion: string
  buildVersion: string | null
  isActive: boolean
  priority: number
}

const AI_DECISION_SCHEMA = z.object({
  primaryFrameworkId: z.string().trim().min(1),
  frameworkVersion: z.string().trim().optional(),
  ecosystem: z
    .enum(["node", "php", "python", "ruby", "java", "go", "rust", "unknown"])
    .optional(),
  confidence: z.number().min(0).max(1),
  requiredRuntimeIds: z.array(
    z.enum(["node", "php", "python", "ruby", "java", "go", "rust"])
  ),
  reasoning: z.array(z.string().trim().min(1)).min(1),
})

type AiDecision = z.infer<typeof AI_DECISION_SCHEMA>

type FrameworkCandidate = {
  id: string
  name: string
  ecosystem: DetectedFramework["ecosystem"]
  points: number
  reasons: string[]
}

type Inventory = {
  files: string[]
  directories: string[]
  packageJsonDependencies: Set<string>
  packageJsonScripts: Set<string>
  composerDependencies: Set<string>
  lockfiles: Set<string>
  evidence: DetectionEvidence[]
}

export type DetectorDependencies = {
  cloneRepository?: (
    input: FrameworkDetectionInput,
    destinationPath: string
  ) => Promise<void>
  resolveWithAi?: (
    candidates: FrameworkCandidate[],
    inventory: Inventory
  ) => Promise<AiDecision>
}
export class FrameworkDetectionError extends Error {
  constructor(
    public readonly code: DetectionErrorCode,
    message: string,
    public readonly inspectionLogId?: string
  ) {
    super(message)
    this.name = "FrameworkDetectionError"
  }
}

export class AiResolverTraceError extends Error {
  constructor(
    public readonly sourceError: unknown,
    public readonly trace: AiDetectionTrace
  ) {
    super(
      sourceError instanceof Error ? sourceError.message : "AI resolver failed."
    )
    this.name = "AiResolverTraceError"
  }
}

const providerModel = () =>
  process.env.AI_DETECTOR_MODEL?.trim() || "gpt-4.1-mini"

const providerBaseUrlHost = () => {
  const configured = process.env.AI_BASE_URL?.trim() || DEFAULT_AI_BASE_URL
  try {
    return new URL(configured).host
  } catch {
    return "invalid"
  }
}

const readProviderStatus = (error: unknown) => {
  if (error instanceof AiResolverTraceError)
    return readProviderStatus(error.sourceError)
  if (!error || typeof error !== "object") return undefined
  const value = error as Record<string, unknown>
  const response = value.response
  const responseStatus =
    response && typeof response === "object"
      ? (response as Record<string, unknown>).status
      : undefined
  const status = value.statusCode ?? value.status ?? responseStatus
  return typeof status === "number" && Number.isInteger(status)
    ? status
    : undefined
}

const readProviderRequestId = (error: unknown) => {
  if (error instanceof AiResolverTraceError)
    return readProviderRequestId(error.sourceError)
  if (!error || typeof error !== "object") return undefined
  const value = error as Record<string, unknown>
  const direct = value.requestId ?? value.requestID
  if (typeof direct === "string" && direct.length > 0)
    return direct.slice(0, 200)

  const headers = value.responseHeaders
  if (!headers || typeof headers !== "object") return undefined
  if (typeof (headers as { get?: unknown }).get === "function") {
    const id = (headers as { get: (name: string) => string | null }).get(
      "x-request-id"
    )
    return id || undefined
  }
  const headerRecord = headers as Record<string, unknown>
  const id = headerRecord["x-request-id"] ?? headerRecord["request-id"]
  return typeof id === "string" && id.length > 0 ? id.slice(0, 200) : undefined
}

const classifyProviderFailure = (
  error: unknown
): DetectionFailureCode | "NETWORK_ERROR" => {
  const sourceError =
    error instanceof AiResolverTraceError ? error.sourceError : error
  const message = sourceError instanceof Error ? sourceError.message : ""
  const status = readProviderStatus(error)
  const hasSchemaIssues =
    sourceError !== null &&
    typeof sourceError === "object" &&
    "issues" in sourceError &&
    Array.isArray(sourceError.issues)
  if (/AI_API_KEY is not configured|API key is not configured/i.test(message)) {
    return "DETECTION_CONFIG_ERROR"
  }
  if (
    hasSchemaIssues ||
    /schema|invalid decision|validation|typevalidation|malformed/i.test(message)
  ) {
    return "DETECTION_SCHEMA_ERROR"
  }
  if (
    /network|fetch failed|timed out|timeout|ECONN|ENOTFOUND|socket/i.test(
      message
    ) &&
    status === undefined
  ) {
    return "NETWORK_ERROR"
  }
  if (
    status !== undefined &&
    [408, 425, 429, 500, 502, 503, 504].includes(status)
  ) {
    return "DETECTION_TRANSIENT_PROVIDER_ERROR"
  }
  if (
    sourceError &&
    typeof sourceError === "object" &&
    (sourceError as Record<string, unknown>).isRetryable === true
  ) {
    return "DETECTION_TRANSIENT_PROVIDER_ERROR"
  }
  return "DETECTION_PROVIDER_ERROR"
}

const safeProviderDiagnostics = (
  error: unknown,
  code: DetectionFailureCode | "NETWORK_ERROR"
): ProviderDiagnostics => {
  const status = readProviderStatus(error)
  return {
    model: providerModel(),
    baseUrlHost: providerBaseUrlHost(),
    ...(status === undefined ? {} : { httpStatus: status }),
    ...(readProviderRequestId(error)
      ? { requestId: readProviderRequestId(error) }
      : {}),
    category:
      code === "DETECTION_CONFIG_ERROR"
        ? "configuration"
        : code === "DETECTION_SCHEMA_ERROR"
          ? "schema"
          : code === "DETECTION_TRANSIENT_PROVIDER_ERROR"
            ? "transient_provider"
            : code === "NETWORK_ERROR"
              ? "network"
              : "provider",
  }
}

const formatProviderDiagnostics = (diagnostics: ProviderDiagnostics) =>
  [
    `model=${diagnostics.model}`,
    `baseUrlHost=${diagnostics.baseUrlHost}`,
    diagnostics.httpStatus === undefined
      ? null
      : `httpStatus=${diagnostics.httpStatus}`,
    diagnostics.requestId ? `requestId=${diagnostics.requestId}` : null,
    `category=${diagnostics.category}`,
  ]
    .filter((value): value is string => value !== null)
    .join(" ")

const safeProviderMessage = (code: DetectionErrorCode) => {
  if (code === "DETECTION_CONFIG_ERROR") {
    return "Automatic detection is not configured. Configure build settings manually."
  }
  if (code === "DETECTION_SCHEMA_ERROR") {
    return "Automatic detection returned an invalid response. Configure build settings manually."
  }
  if (
    code === "DETECTION_TRANSIENT_PROVIDER_ERROR" ||
    code === "NETWORK_ERROR"
  ) {
    return "Automatic detection provider is temporarily unavailable. Retry detection or configure build settings manually."
  }
  if (code === "DETECTION_PROVIDER_ERROR") {
    return "Automatic detection provider failed. Configure build settings manually."
  }
  return "Unable to detect frameworks for this repository."
}

const safeRequestedPath = (value: string | undefined) => {
  if (!value) return undefined
  return value.replace(/[\u0000-\u001f]/g, "").slice(0, 500)
}

const createTrace = (startedAt: number): AiDetectionTrace => ({
  version: AI_DETECTION_TRACE_VERSION,
  terminalStage: "provider",
  elapsedMs: Date.now() - startedAt,
  model: providerModel(),
  baseUrlHost: providerBaseUrlHost(),
  tools: [],
})

const withTraceTerminal = (
  trace: AiDetectionTrace,
  terminalStage: AiDetectionTraceTerminalStage,
  startedAt: number
): AiDetectionTrace => ({
  ...trace,
  terminalStage,
  elapsedMs: Math.max(0, Date.now() - startedAt),
})

const legacyToolCallsToTrace = (
  toolCalls: ToolCallRecord[],
  startedAt: number
): AiDetectionTrace => ({
  ...createTrace(startedAt),
  terminalStage: "completed",
  tools: toolCalls.flatMap((toolCall): AiDetectionToolTrace[] => {
    if (
      toolCall.toolName !== "list_repo_files" &&
      toolCall.toolName !== "read_repo_file"
    ) {
      return []
    }
    const input =
      toolCall.input && typeof toolCall.input === "object"
        ? (toolCall.input as Record<string, unknown>)
        : {}
    const output =
      toolCall.output && typeof toolCall.output === "object"
        ? (toolCall.output as Record<string, unknown>)
        : {}
    const files = output.files
    return [
      {
        name: toolCall.toolName,
        inputSummary: {
          requestedPath: safeRequestedPath(
            typeof input.filePath === "string"
              ? input.filePath
              : typeof input.path === "string"
                ? input.path
                : undefined
          ),
        },
        outcome: toolCall.error ? "failed" : "completed",
        durationMs: 0,
        ...(Array.isArray(files) ? { listedFileCount: files.length } : {}),
        ...(toolCall.error ? { errorCategory: "tool_failure" as const } : {}),
      },
    ]
  }),
})

const normalizeConfidence = (value: number) => {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

const toPosixPath = (value: string) => value.split(path.sep).join("/")

const isHttpGitUrl = (value: string) => {
  try {
    const url = new URL(value)

    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

const runGit = async (
  args: string[],
  options: { cwd?: string; timeoutMs: number }
) => {
  await execFileAsync("git", args, {
    cwd: options.cwd,
    timeout: options.timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  })
}

const cloneRepository = async (
  input: FrameworkDetectionInput,
  destinationPath: string
) => {
  const timeoutMs = input.cloneTimeoutMs ?? DEFAULT_CLONE_TIMEOUT_MS

  if (!isHttpGitUrl(input.repoUrl)) {
    throw new Error("Only http(s) Git URLs are supported.")
  }

  await runGit(["clone", "--depth", "1", input.repoUrl, destinationPath], {
    timeoutMs,
  })

  if (!input.ref) {
    return
  }

  await runGit(["fetch", "--depth", "1", "origin", input.ref], {
    cwd: destinationPath,
    timeoutMs,
  })
  await runGit(["checkout", "--detach", "FETCH_HEAD"], {
    cwd: destinationPath,
    timeoutMs,
  })
}

const listFilesRecursively = async (
  rootPath: string,
  options: { maxFiles: number; maxDepth: number }
) => {
  const files: string[] = []
  const directories = new Set<string>()

  const visit = async (currentPath: string, depth: number) => {
    if (files.length >= options.maxFiles || depth > options.maxDepth) {
      return
    }

    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      if (files.length >= options.maxFiles) {
        break
      }

      if (entry.name === ".git" || entry.name === "node_modules") {
        continue
      }

      const absolutePath = path.join(currentPath, entry.name)
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))

      if (entry.isDirectory()) {
        directories.add(relativePath)
        await visit(absolutePath, depth + 1)
        continue
      }

      files.push(relativePath)
    }
  }

  await visit(rootPath, 0)

  return {
    files,
    directories: Array.from(directories.values()),
    hitLimit: files.length >= options.maxFiles,
  }
}

const parseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value)

    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

const buildInventory = async (
  rootPath: string,
  files: string[],
  directories: string[],
  readManifest: (filePath: string) => Promise<string> = (filePath) =>
    readFile(path.join(rootPath, filePath), "utf8")
): Promise<Inventory> => {
  const evidence: DetectionEvidence[] = []
  const packageJsonDependencies = new Set<string>()
  const packageJsonScripts = new Set<string>()
  const composerDependencies = new Set<string>()
  const lockfiles = new Set<string>()

  const fileSet = new Set(files)

  for (const lockfile of JS_LOCKFILES) {
    if (fileSet.has(lockfile)) {
      lockfiles.add(lockfile)
      evidence.push({
        type: "lockfile",
        value: lockfile,
        detail: "JavaScript package manager lockfile",
      })
    }
  }

  if (fileSet.has("composer.lock")) {
    lockfiles.add("composer.lock")
    evidence.push({
      type: "lockfile",
      value: "composer.lock",
      detail: "PHP Composer lockfile",
    })
  }

  if (fileSet.has("Gemfile.lock")) {
    lockfiles.add("Gemfile.lock")
    evidence.push({
      type: "lockfile",
      value: "Gemfile.lock",
      detail: "Ruby bundler lockfile",
    })
  }

  if (fileSet.has("poetry.lock") || fileSet.has("Pipfile.lock")) {
    lockfiles.add(fileSet.has("poetry.lock") ? "poetry.lock" : "Pipfile.lock")
    evidence.push({
      type: "lockfile",
      value: fileSet.has("poetry.lock") ? "poetry.lock" : "Pipfile.lock",
      detail: "Python dependency lockfile",
    })
  }

  if (fileSet.has("Cargo.lock")) {
    lockfiles.add("Cargo.lock")
    evidence.push({
      type: "lockfile",
      value: "Cargo.lock",
      detail: "Rust Cargo lockfile",
    })
  }

  if (fileSet.has("go.mod")) {
    lockfiles.add("go.mod")
    evidence.push({
      type: "file",
      value: "go.mod",
      detail: "Go module manifest",
    })
  }

  if (fileSet.has("package.json")) {
    const packageText = await readManifest("package.json")
    const packageJson = parseJsonObject(packageText) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    } | null

    const dependencies = {
      ...(packageJson?.dependencies ?? {}),
      ...(packageJson?.devDependencies ?? {}),
    }

    for (const dependency of Object.keys(dependencies)) {
      packageJsonDependencies.add(dependency)
      evidence.push({
        type: "dependency",
        value: dependency,
        detail: "package.json dependency",
      })
    }

    for (const scriptName of Object.keys(packageJson?.scripts ?? {})) {
      packageJsonScripts.add(scriptName)
      evidence.push({
        type: "script",
        value: scriptName,
        detail: "package.json script",
      })
    }
  }

  if (fileSet.has("composer.json")) {
    const composerText = await readManifest("composer.json")
    const composerJson = parseJsonObject(composerText) as {
      require?: Record<string, string>
      ["require-dev"]?: Record<string, string>
    } | null

    const dependencies = {
      ...(composerJson?.require ?? {}),
      ...(composerJson?.["require-dev"] ?? {}),
    }

    for (const dependency of Object.keys(dependencies)) {
      composerDependencies.add(dependency)
      evidence.push({
        type: "dependency",
        value: dependency,
        detail: "composer.json dependency",
      })
    }
  }

  for (const candidate of [
    "artisan",
    "bootstrap/app.php",
    "config/app.php",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.js",
    "vite.config.ts",
    "manage.py",
    "Gemfile",
    "pom.xml",
    "build.gradle",
  ]) {
    if (fileSet.has(candidate)) {
      evidence.push({
        type: "file",
        value: candidate,
      })
    }
  }

  return {
    files,
    directories,
    packageJsonDependencies,
    packageJsonScripts,
    composerDependencies,
    lockfiles,
    evidence,
  }
}

const evaluateDeterministicCandidates = (inventory: Inventory) => {
  const candidates: FrameworkCandidate[] = []

  const hasFile = (target: string) => inventory.files.includes(target)
  const hasDirectory = (target: string) =>
    inventory.directories.some((directory) => directory === target)

  let laravelPoints = 0
  const laravelReasons: string[] = []

  if (hasFile("composer.json")) {
    laravelPoints += 20
    laravelReasons.push("composer.json is present")
  }

  if (hasFile("artisan")) {
    laravelPoints += 35
    laravelReasons.push("artisan CLI entrypoint exists")
  }

  if (hasFile("bootstrap/app.php")) {
    laravelPoints += 25
    laravelReasons.push("bootstrap/app.php exists")
  }

  if (hasFile("config/app.php")) {
    laravelPoints += 10
    laravelReasons.push("config/app.php exists")
  }

  if (inventory.composerDependencies.has("laravel/framework")) {
    laravelPoints += 30
    laravelReasons.push("laravel/framework is in composer dependencies")
  }

  if (
    inventory.packageJsonDependencies.has("laravel-vite-plugin") ||
    hasFile("vite.config.js") ||
    hasFile("vite.config.ts")
  ) {
    laravelPoints += 5
    laravelReasons.push("Node asset pipeline is configured")
  }

  if (laravelPoints >= 40) {
    candidates.push({
      id: "laravel",
      name: "Laravel",
      ecosystem: "php",
      points: Math.min(100, laravelPoints),
      reasons: laravelReasons,
    })
  }

  let nextPoints = 0
  const nextReasons: string[] = []

  if (hasFile("package.json")) {
    nextPoints += 10
    nextReasons.push("package.json is present")
  }

  if (inventory.packageJsonDependencies.has("next")) {
    nextPoints += 45
    nextReasons.push("next dependency is present")
  }

  if (
    hasFile("next.config.js") ||
    hasFile("next.config.mjs") ||
    hasFile("next.config.ts")
  ) {
    nextPoints += 25
    nextReasons.push("next.config file exists")
  }

  if (hasDirectory("app") || hasDirectory("pages")) {
    nextPoints += 10
    nextReasons.push("Next.js app/pages directory exists")
  }

  if (nextPoints >= 40) {
    candidates.push({
      id: "nextjs",
      name: "Next.js",
      ecosystem: "node",
      points: Math.min(100, nextPoints),
      reasons: nextReasons,
    })
  }

  let reactPoints = 0
  const reactReasons: string[] = []

  if (hasFile("package.json")) {
    reactPoints += 10
    reactReasons.push("package.json is present")
  }

  if (inventory.packageJsonDependencies.has("react")) {
    reactPoints += 25
    reactReasons.push("react dependency is present")
  }

  if (hasFile("vite.config.js") || hasFile("vite.config.ts")) {
    reactPoints += 15
    reactReasons.push("Vite config is present")
  }

  if (
    inventory.files.includes("src/main.tsx") ||
    inventory.files.includes("src/main.jsx")
  ) {
    reactPoints += 10
    reactReasons.push("src/main entrypoint exists")
  }

  if (reactPoints >= 35) {
    candidates.push({
      id: "react",
      name: "React",
      ecosystem: "node",
      points: Math.min(100, reactPoints),
      reasons: reactReasons,
    })
  }

  candidates.sort((left, right) => right.points - left.points)

  return candidates
}

const buildRequiredDependencies = (
  primary: FrameworkCandidate | null,
  inventory: Inventory
) => {
  const dependencies: RequiredDependency[] = []
  const addDependency = (nextDependency: RequiredDependency) => {
    if (
      dependencies.some((dependency) => dependency.id === nextDependency.id)
    ) {
      return
    }

    dependencies.push(nextDependency)
  }

  const hasNodeLockfile = JS_LOCKFILES.some((lockfile) =>
    inventory.lockfiles.has(lockfile)
  )

  if (hasNodeLockfile) {
    addDependency({
      id: "node",
      kind: primary?.ecosystem === "node" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "node" ? "app_runtime" : "asset_build",
      confidence: 0.9,
      reason:
        primary?.ecosystem === "node"
          ? "JavaScript lockfile indicates Node runtime is required"
          : "JavaScript lockfile indicates Node is required for asset build",
    })
  }

  if (
    inventory.lockfiles.has("composer.lock") ||
    inventory.files.includes("composer.json")
  ) {
    addDependency({
      id: "php",
      kind: primary?.ecosystem === "php" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "php" ? "app_runtime" : "build_pipeline",
      confidence: 0.9,
      reason:
        primary?.ecosystem === "php"
          ? "Composer files indicate PHP runtime is required"
          : "Composer files indicate PHP dependency in build pipeline",
    })
  }

  if (
    inventory.lockfiles.has("Gemfile.lock") ||
    inventory.files.includes("Gemfile")
  ) {
    addDependency({
      id: "ruby",
      kind: primary?.ecosystem === "ruby" ? "runtime" : "toolchain",
      requiredFor: "build_pipeline",
      confidence: 0.75,
      reason: "Gemfile evidence indicates Ruby toolchain/runtime usage",
    })
  }

  if (
    inventory.lockfiles.has("poetry.lock") ||
    inventory.lockfiles.has("Pipfile.lock") ||
    inventory.files.includes("requirements.txt")
  ) {
    addDependency({
      id: "python",
      kind: primary?.ecosystem === "python" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "python" ? "app_runtime" : "build_pipeline",
      confidence: 0.75,
      reason: "Python dependency files were detected",
    })
  }

  if (inventory.files.includes("go.mod")) {
    addDependency({
      id: "go",
      kind: primary?.ecosystem === "go" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "go" ? "app_runtime" : "build_pipeline",
      confidence: 0.75,
      reason: "Go module manifest was detected",
    })
  }

  if (inventory.lockfiles.has("Cargo.lock")) {
    addDependency({
      id: "rust",
      kind: primary?.ecosystem === "rust" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "rust" ? "app_runtime" : "build_pipeline",
      confidence: 0.75,
      reason: "Cargo lockfile was detected",
    })
  }

  if (
    inventory.files.includes("pom.xml") ||
    inventory.files.includes("build.gradle") ||
    inventory.files.includes("gradlew")
  ) {
    addDependency({
      id: "java",
      kind: primary?.ecosystem === "java" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "java" ? "app_runtime" : "build_pipeline",
      confidence: 0.75,
      reason: "Java build manifest was detected",
    })
  }

  return dependencies
}

const shouldUseAiResolution = (candidates: FrameworkCandidate[]) => {
  if (candidates.length === 0) {
    return true
  }

  const top = candidates[0]
  const second = candidates[1]

  if (!top) {
    return true
  }

  if (top.points < 70) {
    return true
  }

  if (second && top.points - second.points <= 15) {
    return true
  }

  return false
}

const resolveWithAi = async (
  candidates: FrameworkCandidate[],
  inventory: Inventory
): Promise<AiDecision> => {
  const modelName = process.env.AI_DETECTOR_MODEL?.trim() || "gpt-4.1-mini"

  const provider = createOpenAI(getAiProviderConfig())

  const result = await generateObject({
    model: provider(modelName),
    schema: AI_DECISION_SCHEMA,
    prompt: [
      "You are resolving framework detection ambiguity for a source repository.",
      "Pick one primary framework id from the candidates when possible.",
      "Treat mixed lockfiles as dependencies, not necessarily multiple primaries.",
      "Return required runtime ids needed to run/build the repo.",
      "Candidates:",
      JSON.stringify(candidates, null, 2),
      "Detected files and dependencies:",
      JSON.stringify(
        {
          files: inventory.files.slice(0, 250),
          dependencies: Array.from(inventory.packageJsonDependencies),
          composerDependencies: Array.from(inventory.composerDependencies),
          lockfiles: Array.from(inventory.lockfiles),
        },
        null,
        2
      ),
    ].join("\n"),
  })

  return result.object
}

const toDetectedFramework = (
  candidate: FrameworkCandidate
): DetectedFramework => {
  return {
    id: candidate.id,
    name: candidate.name,
    ecosystem: candidate.ecosystem,
    confidence: normalizeConfidence(candidate.points / 100),
    reasons: candidate.reasons,
  }
}

const inferFrameworkName = (id: string) => {
  const mapping: Record<string, string> = {
    laravel: "Laravel",
    nextjs: "Next.js",
    react: "React",
  }

  return mapping[id] ?? id
}

const inferFrameworkEcosystem = (
  id: string
): DetectedFramework["ecosystem"] => {
  const mapping: Record<string, DetectedFramework["ecosystem"]> = {
    laravel: "php",
    nextjs: "node",
    react: "node",
    django: "python",
    flask: "python",
    rails: "ruby",
    sinatra: "ruby",
    spring: "java",
    echo: "go",
    actix: "rust",
  }

  return mapping[id] ?? "unknown"
}

const mapAiRuntimeToDependency = (
  runtimeId: RuntimeId,
  primary: FrameworkCandidate | null
): RequiredDependency => {
  const isPrimaryRuntime = primary?.ecosystem === runtimeId

  return {
    id: runtimeId,
    kind: isPrimaryRuntime ? "runtime" : "toolchain",
    requiredFor: isPrimaryRuntime ? "app_runtime" : "build_pipeline",
    confidence: 0.7,
    reason: "AI disambiguation identified this runtime requirement",
  }
}

// --- GitHub API Tool-Calling AI Resolver ---

const buildDetectorRuleHints = (rules: DetectorRuleRecord[]): string => {
  if (rules.length === 0) {
    return "No admin-defined detector rules are active."
  }

  const hints = rules.map((rule) => {
    const pattern = rule.patternJson as {
      files?: string[]
      dependencies?: string[]
    } | null
    const implications = rule.implicationsJson as {
      framework?: string
      runtime?: string
      impact?: string
    } | null
    const fileList = pattern?.files?.join(", ") ?? "none"
    const depList = pattern?.dependencies?.join(", ") ?? "none"
    const framework = implications?.framework ?? "unknown"
    const impact = implications?.impact ?? "HINT"

    return `- Rule "${rule.name}" (priority ${rule.priority}): if files [${fileList}] or deps [${depList}] found -> framework=${framework}, impact=${impact}`
  })

  return [
    "Admin-defined detector rules (higher priority = more important):",
    ...hints,
  ].join("\n")
}

const buildAiDetectionSystemPrompt = (
  detectorRules: DetectorRuleRecord[]
): string => {
  return [
    "You are a framework detection agent for source repositories.",
    "Inspect repository evidence before deciding: manifests, lockfiles, framework configuration files, package scripts, and Dockerfiles when present.",
    "Conclude the framework, exact version when evidenced, ecosystem, required runtime IDs, build command or build approach, and application port from inspected evidence.",
    "Every conclusion must cite concrete repository evidence in reasoning. Never invent, guess, or infer unsupported values; use an empty optional value or unknown only when the schema permits it.",
    "Return strict JSON only: no markdown, prose, or code fences.",
    "Include every schema field exactly once: primaryFrameworkId, frameworkVersion, ecosystem, confidence, requiredRuntimeIds, reasoning.",
    "frameworkVersion and ecosystem are optional schema fields but must still be included; use an empty string or unknown when evidence is unavailable.",
    buildDetectorRuleHints(detectorRules),
  ].join("\n")
}

const resolveWithAiToolCalling = async (
  input: GithubApiDetectionInput,
  fileList: string[],
  detectorRules: DetectorRuleRecord[],
  dependencies: GithubApiDetectorDependencies
): Promise<AiDecisionResult> => {
  const startedAt = Date.now()
  const trace = createTrace(startedAt)
  let toolFailed = false
  const systemPrompt = buildAiDetectionSystemPrompt(detectorRules)
  const modelName = process.env.AI_DETECTOR_MODEL?.trim() || "gpt-4.1-mini"

  const readFileFn = dependencies.readFile ?? readRepoFile
  const listFilesFn = dependencies.listFiles ?? listRepoFiles

  const toolDefinitions = {
    list_repo_files: tool({
      description:
        "List all files in the repository. Returns a flat list of file paths.",
      inputSchema: z.object({
        path: z.string().optional().describe("Subdirectory to list (optional)"),
      }),
      execute: async ({ path: subPath }) => {
        const toolStartedAt = Date.now()
        const step: AiDetectionToolTrace = {
          name: "list_repo_files",
          inputSummary: { requestedPath: safeRequestedPath(subPath) },
          outcome: "completed",
          durationMs: 0,
        }
        trace.tools.push(step)
        try {
          const result = await listFilesFn({
            installationId: input.installationId,
            owner: input.owner,
            repo: input.repo,
            ref: input.ref,
            path: subPath,
          })
          step.durationMs = Date.now() - toolStartedAt
          step.listedFileCount = result.files.length
          return {
            files: result.files.slice(0, 500),
            truncated: result.truncated,
          }
        } catch (error) {
          toolFailed = true
          step.outcome = "failed"
          step.durationMs = Date.now() - toolStartedAt
          step.errorCategory = "tool_failure"
          throw error
        }
      },
    }),
    read_repo_file: tool({
      description: "Read the content of a single file from the repository.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ filePath }) => {
        const toolStartedAt = Date.now()
        const step: AiDetectionToolTrace = {
          name: "read_repo_file",
          inputSummary: { requestedPath: safeRequestedPath(filePath) },
          outcome: "completed",
          durationMs: 0,
        }
        trace.tools.push(step)
        try {
          const result = await readFileFn({
            installationId: input.installationId,
            owner: input.owner,
            repo: input.repo,
            filePath,
            ref: input.ref,
          })
          step.durationMs = Date.now() - toolStartedAt
          // Truncate large files to avoid token limits.
          const maxContentLength = 10_000
          const content =
            result.content.length > maxContentLength
              ? result.content.slice(0, maxContentLength) + "\n... (truncated)"
              : result.content
          return { content, path: result.path, size: result.size }
        } catch (error) {
          toolFailed = true
          step.outcome = "failed"
          step.durationMs = Date.now() - toolStartedAt
          step.errorCategory = "tool_failure"
          throw error
        }
      },
    }),
  }

  const userPrompt = [
    `Repository: ${input.owner}/${input.repo}`,
    input.ref ? `Branch/Ref: ${input.ref}` : "Using default branch",
    input.subdir ? `Subdirectory: ${input.subdir}` : "",
    "",
    "Initial file listing:",
    fileList.slice(0, 200).join("\n"),
    fileList.length > 200 ? `... and ${fileList.length - 200} more files` : "",
    "",
    "Use the tools to inspect key files (package.json, composer.json, etc.) to determine the framework and its version.",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const provider = createOpenAI(getAiProviderConfig())
    const result = await generateText({
      model: provider(modelName),
      system: systemPrompt,
      prompt: userPrompt,
      tools: toolDefinitions,
      output: Output.object({ schema: AI_DECISION_SCHEMA }),
      stopWhen: stepCountIs(16),
    })

    return {
      decision: result.output,
      trace: withTraceTerminal(trace, "completed", startedAt),
    }
  } catch (error) {
    throw new AiResolverTraceError(
      error,
      withTraceTerminal(trace, toolFailed ? "tool" : "provider", startedAt)
    )
  }
}

// --- RuntimeMapping Enforcement ---

const enforceRuntimeMappings = async (
  frameworkId: string,
  frameworkVersion: string | null,
  suggestedRuntimes: RequiredDependency[],
  prismaClient?: GithubApiDetectorDependencies["prisma"]
): Promise<{ enforced: RequiredDependency[]; appliedMappings: string[] }> => {
  const client = prismaClient ?? (await import("@/lib/prisma")).prisma
  const mappings = await client.detectorRuntimeMapping.findMany({
    where: {
      isActive: true,
      OR: [
        { frameworkId, frameworkVersion },
        { frameworkId, frameworkVersion: null }, // wildcard
      ],
    },
    orderBy: [{ frameworkVersion: "desc" }, { priority: "desc" }],
  })

  if (mappings.length === 0) {
    return { enforced: suggestedRuntimes, appliedMappings: [] }
  }

  const appliedMappings: string[] = []
  const enforced: RequiredDependency[] = []

  for (const mapping of mappings) {
    // Check if this runtime is already in the suggested runtimes
    const existing = suggestedRuntimes.find((r) => r.id === mapping.runtimeId)

    if (existing) {
      // Override with enforced version
      enforced.push({
        ...existing,
        reason: `Enforced by RuntimeMapping: ${mapping.frameworkId} ${mapping.frameworkVersion ?? "*"} -> ${mapping.runtimeId} ${mapping.runtimeVersion}`,
        confidence: 1.0,
      })
      appliedMappings.push(`${mapping.runtimeId} ${mapping.runtimeVersion}`)
    } else {
      // Add as new runtime requirement
      enforced.push({
        id: mapping.runtimeId as RuntimeId,
        kind: "runtime",
        requiredFor: "app_runtime",
        confidence: 1.0,
        reason: `Required by RuntimeMapping: ${mapping.frameworkId} ${mapping.frameworkVersion ?? "*"} -> ${mapping.runtimeId} ${mapping.runtimeVersion}`,
      })
      appliedMappings.push(`${mapping.runtimeId} ${mapping.runtimeVersion}`)
    }
  }

  // Add any suggested runtimes that weren't overridden
  for (const runtime of suggestedRuntimes) {
    if (!enforced.some((e) => e.id === runtime.id)) {
      enforced.push(runtime)
    }
  }

  return { enforced, appliedMappings }
}

// --- DetectorRule BLOCK Logic ---

const checkForBlockedFrameworks = (
  fileList: string[],
  detectorRules: DetectorRuleRecord[]
): { blocked: boolean; rule?: DetectorRuleRecord; matchedFiles: string[] } => {
  // Sort rules by priority (highest first)
  const sortedRules = [...detectorRules].sort((a, b) => b.priority - a.priority)

  for (const rule of sortedRules) {
    const pattern = rule.patternJson as {
      files?: string[]
      dependencies?: string[]
    } | null
    const implications = rule.implicationsJson as { impact?: string } | null

    if (implications?.impact !== "BLOCK") {
      continue
    }

    if (!pattern?.files) {
      continue
    }

    const matchedFiles = pattern.files.filter((file) => fileList.includes(file))

    if (matchedFiles.length > 0) {
      return { blocked: true, rule, matchedFiles }
    }
  }

  return { blocked: false, matchedFiles: [] }
}

const summarizeDetectorRules = (
  rules: DetectorRuleRecord[]
): DetectorRuleSummary => {
  const active = rules.filter((r) => r.isActive)
  const impacts = [
    ...new Set(
      active
        .map((r) => (r.implicationsJson as { impact?: string })?.impact)
        .filter((i): i is string => i !== undefined)
    ),
  ].sort()
  const blockRuleNames = active
    .filter(
      (r) => (r.implicationsJson as { impact?: string })?.impact === "BLOCK"
    )
    .map((r) => r.name)
    .sort()
  const launchRuleNames = active
    .filter(
      (r) => (r.implicationsJson as { impact?: string })?.impact === "LAUNCH"
    )
    .map((r) => r.name)
    .sort()
  return {
    activeCount: active.length,
    impacts,
    blockRuleNames,
    launchRuleNames,
  }
}

// --- Support Decision Evaluation ---

/**
 * Evaluates whether the detected framework is launchable under the configured
 * DetectorRule policy. The function is pure and side-effect free; callers are
 * responsible for fetching rules and (optionally) attaching a "blocked"
 * evidence entry before invoking it.
 *
 * Decision flow:
 *  1. If a BLOCK rule has been matched (signaled via evidence), return blocked.
 *  2. If no primary framework was detected, return unsupported.
 *  3. If a LAUNCH rule matches the framework id, evaluate the confidence gate.
 *  4. Otherwise, return unsupported with a message listing the supported set.
 */
export const evaluateSupportDecision = (
  result: Pick<DetectionResult, "primaryFramework" | "confidence" | "evidence">,
  rules: DetectorRuleRecord[]
): DetectionDecision => {
  const frameworkId = result.primaryFramework?.id
  const confidence = result.confidence

  // 1. BLOCK (signaled by an evidence entry with value "blocked")
  const blockedEvidence = result.evidence.find(
    (entry) => entry.value === "blocked"
  )

  if (blockedEvidence) {
    const blockRule = rules.find(
      (rule) =>
        rule.implicationsJson &&
        (rule.implicationsJson as { impact?: string }).impact === "BLOCK" &&
        blockedEvidence.detail?.includes(rule.name)
    )

    return {
      status: "blocked",
      message: `Deployment blocked by admin rule: ${blockRule?.name ?? "unknown rule"}`,
      isLaunchable: false,
    }
  }

  if (!frameworkId) {
    return {
      status: "unsupported",
      message: "We couldn't verify a supported framework in this repository.",
      isLaunchable: false,
    }
  }

  // 2. LAUNCH match
  const launchRule = rules.find((rule) => {
    const implications = rule.implicationsJson as {
      impact?: string
      framework?: string
    } | null
    const pattern = rule.patternJson as { frameworkId?: string } | null

    if (implications?.impact !== "LAUNCH") {
      return false
    }

    return (
      pattern?.frameworkId === frameworkId ||
      implications?.framework === frameworkId
    )
  })

  if (!launchRule) {
    // Derive supported frameworks from LAUNCH rules
    const launchFrameworks = rules
      .filter(
        (r) => (r.implicationsJson as { impact?: string })?.impact === "LAUNCH"
      )
      .map((r) => {
        const impl = r.implicationsJson as { framework?: string }
        const pattern = r.patternJson as { frameworkId?: string }
        return pattern?.frameworkId ?? impl?.framework
      })
      .filter(Boolean)

    const supportedList =
      launchFrameworks.length > 0
        ? launchFrameworks.join(", ")
        : "no frameworks"

    return {
      status: "unsupported",
      message: `Your framework was detected as ${result.primaryFramework?.name ?? frameworkId}, but we currently only support ${supportedList}.`,
      isLaunchable: false,
    }
  }

  const implications = launchRule.implicationsJson as {
    minConfidence?: number
  } | null
  const minConfidence = implications?.minConfidence ?? 0.8

  if (confidence < minConfidence) {
    return {
      status: "low_confidence",
      message: `We detected ${result.primaryFramework?.name ?? frameworkId} but with low confidence (${(confidence * 100).toFixed(0)}%). Please verify your repository structure.`,
      isLaunchable: false,
    }
  }

  return {
    status: "success",
    message: "Ready to deploy.",
    isLaunchable: true,
  }
}

/**
 * The file-based detector does not have access to DetectorRule policies.
 * Default to an "unsupported" decision — callers using the GitHub API path
 * get the full policy evaluation, while file-based callers must opt in via
 * the `evaluateSupportDecision` helper if they have rules available.
 *
 * NOTE: `decision.isLaunchable` will always be `false` for this code path,
 * regardless of whether a framework was detected.
 */
const fromInventory = async (
  input: FrameworkDetectionInput,
  inventory: Inventory,
  dependencies: DetectorDependencies
): Promise<DetectionResult> => {
  const warnings: string[] = []
  const candidates = evaluateDeterministicCandidates(inventory)
  const shouldUseAi = shouldUseAiResolution(candidates)

  let selected = candidates[0] ?? null
  let aiDependencies: RequiredDependency[] = []

  if (shouldUseAi) {
    try {
      const aiResolver = dependencies.resolveWithAi ?? resolveWithAi
      const aiDecision = await aiResolver(candidates, inventory)
      const aiFramework = candidates.find(
        (candidate) => candidate.id === aiDecision.primaryFrameworkId
      )

      if (aiFramework) {
        selected = {
          ...aiFramework,
          points: Math.max(aiFramework.points, aiDecision.confidence * 100),
          reasons: [...aiFramework.reasons, ...aiDecision.reasoning],
        }
      } else {
        selected = {
          id: aiDecision.primaryFrameworkId,
          name: inferFrameworkName(aiDecision.primaryFrameworkId),
          ecosystem: "unknown",
          points: aiDecision.confidence * 100,
          reasons: aiDecision.reasoning,
        }
      }

      aiDependencies = aiDecision.requiredRuntimeIds.map((runtimeId) =>
        mapAiRuntimeToDependency(runtimeId, selected)
      )

      inventory.evidence.push({
        type: "ai",
        value: "ai-disambiguation",
        detail: `Model selected ${aiDecision.primaryFrameworkId}`,
      })
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `AI fallback skipped: ${error.message}`
          : "AI fallback skipped due to unknown error"
      )
    }
  }

  const requiredDependencies = buildRequiredDependencies(selected, inventory)

  for (const nextDependency of aiDependencies) {
    if (
      !requiredDependencies.some(
        (dependency) => dependency.id === nextDependency.id
      )
    ) {
      requiredDependencies.push(nextDependency)
    }
  }

  const primaryFramework = selected ? toDetectedFramework(selected) : null
  const alternatives = candidates
    .filter((candidate) => candidate.id !== selected?.id)
    .map(toDetectedFramework)

  // The file-based detector does not have access to DetectorRule policies.
  // Default to an "unsupported" decision — callers using the GitHub API path
  // get the full policy evaluation, while file-based callers must opt in via
  // the `evaluateSupportDecision` helper if they have rules available.
  const decision: DetectionDecision = primaryFramework
    ? {
        status: "unsupported",
        message: "Policy evaluation is not available for file-based detection.",
        isLaunchable: false,
      }
    : {
        status: "unsupported",
        message: "We couldn't verify a supported framework in this repository.",
        isLaunchable: false,
      }

  return {
    primaryFramework,
    requiredDependencies,
    alternatives,
    confidence: primaryFramework?.confidence ?? 0,
    decision,
    evidence: inventory.evidence,
    warnings,
    source: {
      repoUrl: input.repoUrl,
      ref: input.ref,
      subdir: input.subdir,
    },
  }
}

export const detectFrameworkFromGitRepo = async (
  input: FrameworkDetectionInput,
  dependencies: DetectorDependencies = {}
): Promise<DetectionResult> => {
  const maxFiles = input.maxScanFiles ?? DEFAULT_MAX_SCAN_FILES
  const maxDepth = input.maxDepth ?? DEFAULT_MAX_DEPTH
  const scanTimeoutMs = input.scanTimeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS

  const tempRootPath = await mkdtemp(
    path.join(tmpdir(), "framework-detection-")
  )

  try {
    const clone = dependencies.cloneRepository ?? cloneRepository
    await clone(input, tempRootPath)

    const repoRootPath = input.subdir
      ? path.resolve(tempRootPath, input.subdir)
      : tempRootPath

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Repository scan timed out"))
      }, scanTimeoutMs)
    })

    const scan = (async () => {
      const { files, directories, hitLimit } = await listFilesRecursively(
        repoRootPath,
        {
          maxFiles,
          maxDepth,
        }
      )
      const inventory = await buildInventory(repoRootPath, files, directories)

      if (hitLimit) {
        inventory.evidence.push({
          type: "file",
          value: "scan-limit",
          detail: `Stopped after ${maxFiles} files`,
        })
      }

      return fromInventory(input, inventory, dependencies)
    })()

    return await Promise.race([scan, timeout])
  } finally {
    await rm(tempRootPath, { recursive: true, force: true })
  }
}

// --- GitHub API Detection (AI-First with Tool Calling) ---

export const detectFrameworkFromGithubApi = async (
  input: GithubApiDetectionInput,
  dependencies: GithubApiDetectorDependencies = {}
): Promise<DetectionResult> => {
  const warnings: string[] = []
  const evidence: DetectionEvidence[] = []
  const prismaClient =
    dependencies.prisma ?? (await import("@/lib/prisma")).prisma
  const listFilesFn = dependencies.listFiles ?? listRepoFiles
  const readFileFn =
    dependencies.readFile ??
    (dependencies.resolveWithAiToolCalling ? undefined : readRepoFile)
  const source = {
    repoUrl: `https://github.com/${input.owner}/${input.repo}`,
    ref: input.ref,
    subdir: input.subdir,
  }
  const { files: fileList, truncated } = await listFilesFn({
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
    ref: input.ref,
    path: input.subdir,
  })
  if (truncated) {
    warnings.push("File listing was truncated by GitHub API")
    evidence.push({
      type: "file",
      value: "truncated-listing",
      detail: "GitHub API returned truncated file tree",
    })
  }
  const detectorRules = await prismaClient.detectorRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  })
  const ruleSummary = summarizeDetectorRules(detectorRules)
  const writeInspectionLog = async (data: Record<string, unknown>) => {
    try {
      const created = await prismaClient.detectorInspectionLog.create({ data })
      return typeof created?.id === "string" ? created.id : undefined
    } catch {
      warnings.push("Failed to log detector inspection")
      return undefined
    }
  }
  const blockCheck = checkForBlockedFrameworks(fileList, detectorRules)
  if (blockCheck.blocked && blockCheck.rule) {
    const blockedFramework = blockCheck.rule.implicationsJson as {
      framework?: string
    } | null
    evidence.push({
      type: "file",
      value: "blocked",
      detail: `Blocked by rule "${blockCheck.rule.name}": matched files ${blockCheck.matchedFiles.join(", ")}`,
    })
    const inspectionLogId = await writeInspectionLog({
      installationId: BigInt(input.installationId),
      repoUrl: source.repoUrl,
      ref: input.ref,
      detectedFramework: blockedFramework?.framework ?? "unknown",
      status: "blocked",
      blockedByRuleId: blockCheck.rule.id,
      reasoning: [`Blocked by rule: ${blockCheck.rule.name}`],
      warnings,
    })
    return {
      primaryFramework: {
        id: blockedFramework?.framework ?? "unknown",
        name: blockedFramework?.framework ?? "Unknown",
        ecosystem: "unknown",
        confidence: 0,
        reasons: [`Blocked by admin rule: ${blockCheck.rule.name}`],
      },
      requiredDependencies: [],
      alternatives: [],
      confidence: 0,
      decision: {
        status: "blocked",
        message: `Deployment blocked by admin rule: ${blockCheck.rule.name}`,
        isLaunchable: false,
      },
      evidence,
      warnings: [
        ...warnings,
        `Framework blocked by rule: ${blockCheck.rule.name}`,
      ],
      source,
      inspectionLogId,
    }
  }
  const directories = [
    ...new Set(
      fileList.flatMap((file) => {
        const parts = file.split("/")
        return parts
          .slice(0, -1)
          .map((_, index) => parts.slice(0, index + 1).join("/"))
      })
    ),
  ]
  const inventory = await buildInventory(
    "",
    fileList,
    directories,
    async (filePath) => {
      try {
        if (!readFileFn) return ""
        return (
          await readFileFn({
            installationId: input.installationId,
            owner: input.owner,
            repo: input.repo,
            filePath,
            ref: input.ref,
            subdir: input.subdir,
          })
        ).content
      } catch {
        warnings.push(`Unable to read manifest: ${filePath}`)
        return ""
      }
    }
  )
  const candidates = evaluateDeterministicCandidates(inventory)
  const startTime = Date.now()
  const fallback = async (
    error: unknown,
    code: DetectionFailureCode | "NETWORK_ERROR",
    trace?: AiDetectionTrace
  ): Promise<DetectionResult> => {
    const diagnostics = safeProviderDiagnostics(error, code)
    const diagnosticWarning = formatProviderDiagnostics(diagnostics)
    const terminalTrace = trace
      ? withTraceTerminal(
          trace,
          code === "DETECTION_SCHEMA_ERROR" ? "output" : trace.terminalStage,
          startTime
        )
      : undefined
    if (terminalTrace?.terminalStage === "completed") {
      terminalTrace.terminalStage = "provider"
    }
    if (candidates.length === 0) {
      const safeMessage = safeProviderMessage(code)
      const ruleContext = `DetectorRule context: activeCount=${ruleSummary.activeCount}; impacts=${ruleSummary.impacts.join(",")}; blockRules=${ruleSummary.blockRuleNames.join(",")}; launchRules=${ruleSummary.launchRuleNames.join(",")}`
      const inspectionLogId = await writeInspectionLog({
        installationId: BigInt(input.installationId),
        repoUrl: source.repoUrl,
        ref: input.ref,
        status: "error",
        errorMessage: `${safeMessage} | ${ruleContext}`,
        aiTrace: terminalTrace,
        providerDiagnostics: diagnostics,
        reasoning: [],
        warnings: [...warnings, diagnosticWarning],
      })
      throw new FrameworkDetectionError(code, safeMessage, inspectionLogId)
    }
    const selected = candidates[0]
    if (!selected)
      throw new FrameworkDetectionError(
        "DETECTION_FAILED",
        "Unable to detect frameworks for this repository."
      )
    evidence.push({
      type: "file",
      value: "github-deterministic-fallback",
      detail: "AI provider failure; framework selected from GitHub evidence",
    })
    warnings.push(
      "AI provider failed; deterministic GitHub evidence fallback used",
      diagnosticWarning
    )
    const primaryFramework = toDetectedFramework(selected)
    const { enforced, appliedMappings } = await enforceRuntimeMappings(
      selected.id,
      null,
      buildRequiredDependencies(selected, inventory),
      prismaClient
    )
    const decision = evaluateSupportDecision(
      { primaryFramework, confidence: primaryFramework.confidence, evidence },
      detectorRules
    )
    const enforcedRuntimes = enforced.map((dependency) => ({
      runtimeId: dependency.id,
      version:
        appliedMappings
          .find((mapping) => mapping.startsWith(dependency.id))
          ?.replace(`${dependency.id} `, "") ?? "unknown",
    }))
    const inspectionLogId = await writeInspectionLog({
      installationId: BigInt(input.installationId),
      repoUrl: source.repoUrl,
      ref: input.ref,
      detectedFramework: selected.id,
      confidence: primaryFramework.confidence,
      enforcedRuntimes,
      aiTrace: terminalTrace,
      providerDiagnostics: diagnostics,
      reasoning: selected.reasons,
      warnings,
      status: decision.status,
    })
    return {
      primaryFramework,
      requiredDependencies: enforced,
      alternatives: candidates
        .filter((candidate) => candidate.id !== selected.id)
        .map(toDetectedFramework),
      confidence: primaryFramework.confidence,
      decision,
      evidence: inventory.evidence.concat(evidence),
      warnings,
      source,
      inspectionLogId,
      frameworkVersion: null,
      defaultPort: DEFAULT_PORT_MAP[selected.id] ?? null,
      enforcedRuntimes,
    }
  }
  let aiDecision: AiDecision
  let capturedTrace: AiDetectionTrace | undefined
  try {
    const resolver =
      dependencies.resolveWithAiToolCalling ??
      ((inp, files, rules) =>
        resolveWithAiToolCalling(inp, files, rules, dependencies))
    const resolverResult = await resolver(input, fileList, detectorRules)
    capturedTrace =
      resolverResult.trace ??
      legacyToolCallsToTrace(resolverResult.toolCalls ?? [], startTime)
    aiDecision = AI_DECISION_SCHEMA.parse(resolverResult.decision)
  } catch (error) {
    const trace =
      error instanceof AiResolverTraceError ? error.trace : capturedTrace
    return fallback(error, classifyProviderFailure(error), trace)
  }
  const frameworkId = aiDecision.primaryFrameworkId
  const frameworkVersion = aiDecision.frameworkVersion ?? null
  const normalizedConfidence = normalizeConfidence(aiDecision.confidence)
  const primaryFramework: DetectedFramework = {
    id: frameworkId,
    name: inferFrameworkName(frameworkId),
    ecosystem: aiDecision.ecosystem ?? inferFrameworkEcosystem(frameworkId),
    confidence: normalizedConfidence,
    reasons: aiDecision.reasoning,
  }
  evidence.push({
    type: "ai",
    value: "tool-calling-detection",
    detail: `AI agent selected ${frameworkId} with confidence ${aiDecision.confidence}`,
  })
  const requiredDependencies = aiDecision.requiredRuntimeIds.map(
    (runtimeId) => ({
      id: runtimeId,
      kind: "runtime" as const,
      requiredFor: "app_runtime" as const,
      confidence: normalizedConfidence,
      reason:
        aiDecision.reasoning[0] ??
        "AI agent identified this runtime requirement",
    })
  )
  const { enforced: enforcedDependencies, appliedMappings } =
    await enforceRuntimeMappings(
      frameworkId,
      frameworkVersion,
      requiredDependencies,
      prismaClient
    )
  if (appliedMappings.length > 0)
    evidence.push({
      type: "ai",
      value: "runtime-mapping-enforced",
      detail: `Applied runtime mappings: ${appliedMappings.join(", ")}`,
    })
  const decision = evaluateSupportDecision(
    { primaryFramework, confidence: normalizedConfidence, evidence },
    detectorRules
  )
  const enforcedRuntimes = enforcedDependencies.map((dependency) => ({
    runtimeId: dependency.id,
    version:
      appliedMappings
        .find((mapping) => mapping.startsWith(dependency.id))
        ?.replace(`${dependency.id} `, "") ?? "unknown",
  }))
  const inspectionLogId = await writeInspectionLog({
    installationId: BigInt(input.installationId),
    repoUrl: source.repoUrl,
    ref: input.ref,
    detectedFramework: frameworkId,
    confidence: normalizedConfidence,
    enforcedRuntimes,
    aiTrace: capturedTrace
      ? withTraceTerminal(capturedTrace, "completed", startTime)
      : undefined,
    reasoning: aiDecision.reasoning,
    warnings,
    durationMs: Date.now() - startTime,
    status: decision.status,
  })
  return {
    primaryFramework,
    requiredDependencies: enforcedDependencies,
    alternatives: [],
    confidence: normalizedConfidence,
    decision,
    evidence,
    warnings,
    source,
    inspectionLogId,
    frameworkVersion,
    defaultPort: DEFAULT_PORT_MAP[frameworkId] ?? null,
    enforcedRuntimes,
  }
}

export const __testables = {
  buildInventory,
  evaluateDeterministicCandidates,
  buildRequiredDependencies,
  shouldUseAiResolution,
  fromInventory,
  checkForBlockedFrameworks,
  buildDetectorRuleHints,
  buildAiDetectionSystemPrompt,
  enforceRuntimeMappings,
  inferFrameworkEcosystem,
  summarizeDetectorRules,
  evaluateSupportDecision,
}
