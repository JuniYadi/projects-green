import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

import type {
  DetectionEvidence,
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

const JS_LOCKFILES = ["bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]

const AI_DECISION_SCHEMA = z.object({
  primaryFrameworkId: z.string().trim().min(1),
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

  await runGit(
    ["fetch", "--depth", "1", "origin", input.ref],
    {
      cwd: destinationPath,
      timeoutMs,
    }
  )
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
  directories: string[]
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
    const packageText = await readFile(path.join(rootPath, "package.json"), "utf8")
    const packageJson = parseJsonObject(packageText) as
      | {
          dependencies?: Record<string, string>
          devDependencies?: Record<string, string>
          scripts?: Record<string, string>
        }
      | null

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
    const composerText = await readFile(path.join(rootPath, "composer.json"), "utf8")
    const composerJson = parseJsonObject(composerText) as
      | {
          require?: Record<string, string>
          ["require-dev"]?: Record<string, string>
        }
      | null

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
    if (dependencies.some((dependency) => dependency.id === nextDependency.id)) {
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
      kind:
        primary?.ecosystem === "node" ? "runtime" : "toolchain",
      requiredFor:
        primary?.ecosystem === "node" ? "app_runtime" : "asset_build",
      confidence: 0.9,
      reason:
        primary?.ecosystem === "node"
          ? "JavaScript lockfile indicates Node runtime is required"
          : "JavaScript lockfile indicates Node is required for asset build",
    })
  }

  if (inventory.lockfiles.has("composer.lock") || inventory.files.includes("composer.json")) {
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

  if (inventory.lockfiles.has("Gemfile.lock") || inventory.files.includes("Gemfile")) {
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
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const modelName = process.env.AI_DETECTOR_MODEL?.trim() || "gpt-4.1-mini"

  const provider = createOpenAI({ apiKey })

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

const toDetectedFramework = (candidate: FrameworkCandidate): DetectedFramework => {
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
    if (!requiredDependencies.some((dependency) => dependency.id === nextDependency.id)) {
      requiredDependencies.push(nextDependency)
    }
  }

  const primaryFramework = selected ? toDetectedFramework(selected) : null
  const alternatives = candidates
    .filter((candidate) => candidate.id !== selected?.id)
    .map(toDetectedFramework)

  return {
    primaryFramework,
    requiredDependencies,
    alternatives,
    confidence: primaryFramework?.confidence ?? 0,
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

  const tempRootPath = await mkdtemp(path.join(tmpdir(), "framework-detection-"))

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

export const __testables = {
  buildInventory,
  evaluateDeterministicCandidates,
  buildRequiredDependencies,
  shouldUseAiResolution,
  fromInventory,
}
