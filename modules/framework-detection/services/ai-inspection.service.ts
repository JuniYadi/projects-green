import { createOpenAI } from "@ai-sdk/openai"
import type { PrismaClient } from "@prisma/client"
import { generateText, Output, stepCountIs } from "ai"
import { z } from "zod"
import { getAiProviderConfig } from "@/lib/ai-config"
import { prisma } from "@/lib/prisma"
import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import {
  type GitProviderAdapter,
  resolveGitProvider,
} from "@/modules/deploy/git-provider"
import { createRepoInspectorTools } from "../ai-tools/repo-inspector.tools"
import type {
  AiDetectionToolTrace,
  AiDetectionTrace,
} from "../framework-detection.trace"
import type {
  DetectedFramework,
  DetectionDecision,
  DetectionEcosystem,
  DetectionEvidence,
  DetectionResult,
  RequiredDependency,
  RuntimeId,
} from "../framework-detection.types"
import { DetectorRuleEvaluator } from "./detector-rule-evaluator.service"
export type { PolicyRuleEvaluationResult } from "./detector-rule-evaluator.service"

const DEFAULT_PORT_MAP: Record<string, number> = {
  nextjs: 3000,
  react: 3000,
  nestjs: 3000,
  express: 3000,
  nuxt: 3000,
  remix: 3000,
  astro: 4321,
  svelte: 5173,
  vue: 5173,
  laravel: 80,
  wordpress: 80,
  django: 8000,
  fastapi: 8000,
  flask: 5000,
  gin: 8080,
  rust: 8080,
}

export const AI_INSPECTION_DECISION_SCHEMA = z.object({
  primaryFrameworkId: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Detected framework identifier in lowercase, e.g. 'nextjs', 'laravel', 'express', or 'unknown'"
    ),
  frameworkName: z
    .string()
    .trim()
    .optional()
    .describe("Human readable framework name, e.g. 'Next.js'"),
  frameworkVersion: z
    .string()
    .trim()
    .optional()
    .describe("Detected framework version string, e.g. '14.2.0'"),
  ecosystem: z
    .enum(["node", "php", "python", "ruby", "java", "go", "rust", "unknown"])
    .default("node"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score between 0.0 and 1.0"),
  defaultPort: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Default application port"),
  startScript: z
    .string()
    .trim()
    .optional()
    .describe("Application start command, e.g. 'npm run start'"),
  requiredRuntimeIds: z
    .array(z.enum(["node", "php", "python", "ruby", "java", "go", "rust"]))
    .default([]),
  runtimeVersion: z
    .string()
    .trim()
    .optional()
    .describe("Runtime version, e.g. '20' or '8.2'"),
  envDefaults: z
    .record(z.string(), z.string())
    .optional()
    .describe("Key-value map of default environment variables"),
  reasoning: z.array(z.string().trim().min(1)).default([]),
  warnings: z.array(z.string().trim()).default([]),
})

export type AiInspectionDecision = z.infer<typeof AI_INSPECTION_DECISION_SCHEMA>

export type UniversalInspectionDependencies = {
  db?: PrismaClient
  resolveGitProvider?: (url: string) => GitProviderAdapter
  adapter?: GitProviderAdapter
  createOpenAI?: typeof createOpenAI
  generateText?: typeof generateText
  getAiConfig?: typeof getAiProviderConfig
  model?: string
  evaluator?: DetectorRuleEvaluator
}

export type UniversalInspectionInput = {
  repoUrl: string
  ref?: string
  subpath?: string
  actor?: AiDeploymentSessionActor
  sessionId?: string
  dependencies?: UniversalInspectionDependencies
}

export type UniversalInspectionOutput = DetectionResult & {
  result: DetectionResult
  aiTrace: AiDetectionTrace | null
}

const SYSTEM_PROMPT = `You are an expert deployment assistant and software manifest analyzer.
Your task is to inspect the repository manifests (e.g. package.json, composer.json, Dockerfile, requirements.txt, pyproject.toml, go.mod, Cargo.toml, .env.example) to determine:
1. The primary framework and its name/version (e.g. nextjs, laravel, express, remix, nuxt, django, fastapi, etc.)
2. The primary ecosystem and required runtimes (e.g. node, php, python, go, rust)
3. The default listen port (e.g. 3000 for Next.js/Express, 8000 for Laravel/FastAPI, 8080, etc.)
4. The start script / entrypoint command (e.g. "npm run start", "php artisan serve", "python -m uvicorn ...")
5. Recommended runtime version (e.g. "20", "22", "8.2", "3.11")
6. Default environment variables found in .env.example or configuration files
7. A confidence score between 0.0 and 1.0 reflecting how certain you are based on actual manifest evidence.

Use list_repo_files to inspect the file structure, and read_repo_file to read key manifest contents.
Use evaluate_detector_rules to evaluate platform security and deployment governance rules.
Do not guess: read the manifest files before concluding your decision.`

function parseEnvExample(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) {
      let val = match[2].trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      env[match[1]] = val
    }
  }
  return env
}

async function runDeterministicManifestInspection(params: {
  adapter: GitProviderAdapter
  repoUrl: string
  ref?: string
  subpath?: string
  actor?: AiDeploymentSessionActor
}): Promise<{
  frameworkId: string | null
  frameworkName: string | null
  frameworkVersion: string | null
  ecosystem: DetectionEcosystem
  confidence: number
  defaultPort: number | null
  startScript: string | null
  runtimeId: RuntimeId | null
  runtimeVersion: string | null
  envDefaults: Record<string, string>
  reasons: string[]
  evidence: DetectionEvidence[]
}> {
  const { adapter, repoUrl, ref, subpath, actor } = params
  const cleanSubpath = subpath ? subpath.replace(/^\/+|\/+$/g, "") : ""

  let treeFiles: string[] = []
  try {
    const tree = await adapter.listTree(repoUrl, ref, subpath, actor)
    treeFiles = tree.files
  } catch {
    treeFiles = []
  }

  const resolvePath = (file: string) =>
    cleanSubpath ? `${cleanSubpath}/${file}` : file

  const fileExists = (target: string) => {
    return (
      treeFiles.includes(target) ||
      treeFiles.includes(resolvePath(target)) ||
      treeFiles.some((f) => f.endsWith(`/${target}`))
    )
  }

  let envDefaults: Record<string, string> = {}
  if (fileExists(".env.example")) {
    try {
      const file = await adapter.readFile(
        repoUrl,
        resolvePath(".env.example"),
        ref,
        actor
      )
      envDefaults = parseEnvExample(file.content)
    } catch {
      // ignore
    }
  }

  let exposedPort: number | null = null
  if (fileExists("Dockerfile")) {
    try {
      const dockerfile = await adapter.readFile(
        repoUrl,
        resolvePath("Dockerfile"),
        ref,
        actor
      )
      const portMatch = dockerfile.content.match(/EXPOSE\s+(\d+)/i)
      if (portMatch) {
        exposedPort = Number.parseInt(portMatch[1], 10)
      }
    } catch {
      // ignore
    }
  }

  // 1. Node / package.json check
  if (fileExists("package.json")) {
    try {
      const pkgFile = await adapter.readFile(
        repoUrl,
        resolvePath("package.json"),
        ref,
        actor
      )
      const pkg = JSON.parse(pkgFile.content)
      const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      }

      if (deps.next) {
        return {
          frameworkId: "nextjs",
          frameworkName: "Next.js",
          frameworkVersion: String(deps.next),
          ecosystem: "node",
          confidence: 0.95,
          defaultPort: exposedPort ?? 3000,
          startScript: pkg.scripts?.start ? "npm run start" : "next start",
          runtimeId: "node",
          runtimeVersion: "20",
          envDefaults,
          reasons: ["package.json contains next dependency"],
          evidence: [
            {
              type: "dependency",
              value: "next",
              detail: String(deps.next),
            },
          ],
        }
      }

      if (deps["@remix-run/react"]) {
        return {
          frameworkId: "remix",
          frameworkName: "Remix",
          frameworkVersion: String(deps["@remix-run/react"]),
          ecosystem: "node",
          confidence: 0.9,
          defaultPort: exposedPort ?? 3000,
          startScript: pkg.scripts?.start ? "npm run start" : "remix-serve",
          runtimeId: "node",
          runtimeVersion: "20",
          envDefaults,
          reasons: ["package.json contains @remix-run/react dependency"],
          evidence: [
            {
              type: "dependency",
              value: "@remix-run/react",
              detail: String(deps["@remix-run/react"]),
            },
          ],
        }
      }

      if (deps.nuxt || deps["nuxt3"]) {
        return {
          frameworkId: "nuxt",
          frameworkName: "Nuxt",
          frameworkVersion: String(deps.nuxt ?? deps["nuxt3"]),
          ecosystem: "node",
          confidence: 0.9,
          defaultPort: exposedPort ?? 3000,
          startScript: pkg.scripts?.start
            ? "npm run start"
            : "node .output/server/index.mjs",
          runtimeId: "node",
          runtimeVersion: "20",
          envDefaults,
          reasons: ["package.json contains nuxt dependency"],
          evidence: [
            {
              type: "dependency",
              value: "nuxt",
              detail: String(deps.nuxt ?? deps["nuxt3"]),
            },
          ],
        }
      }

      if (deps["@nestjs/core"]) {
        return {
          frameworkId: "nestjs",
          frameworkName: "NestJS",
          frameworkVersion: String(deps["@nestjs/core"]),
          ecosystem: "node",
          confidence: 0.9,
          defaultPort: exposedPort ?? 3000,
          startScript: pkg.scripts?.start ? "npm run start" : "node dist/main",
          runtimeId: "node",
          runtimeVersion: "20",
          envDefaults,
          reasons: ["package.json contains @nestjs/core dependency"],
          evidence: [
            {
              type: "dependency",
              value: "@nestjs/core",
              detail: String(deps["@nestjs/core"]),
            },
          ],
        }
      }

      if (deps.express) {
        return {
          frameworkId: "express",
          frameworkName: "Express",
          frameworkVersion: String(deps.express),
          ecosystem: "node",
          confidence: 0.85,
          defaultPort: exposedPort ?? 3000,
          startScript: pkg.scripts?.start ? "npm run start" : "node index.js",
          runtimeId: "node",
          runtimeVersion: "20",
          envDefaults,
          reasons: ["package.json contains express dependency"],
          evidence: [
            {
              type: "dependency",
              value: "express",
              detail: String(deps.express),
            },
          ],
        }
      }

      if (deps.react) {
        return {
          frameworkId: "react",
          frameworkName: "React",
          frameworkVersion: String(deps.react),
          ecosystem: "node",
          confidence: 0.8,
          defaultPort: exposedPort ?? 3000,
          startScript: pkg.scripts?.start ? "npm run start" : "serve -s build",
          runtimeId: "node",
          runtimeVersion: "20",
          envDefaults,
          reasons: ["package.json contains react dependency"],
          evidence: [
            {
              type: "dependency",
              value: "react",
              detail: String(deps.react),
            },
          ],
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  // 2. PHP / Laravel check
  if (fileExists("composer.json") || fileExists("artisan")) {
    try {
      let laravelVersion: string | null = null
      if (fileExists("composer.json")) {
        const composerFile = await adapter.readFile(
          repoUrl,
          resolvePath("composer.json"),
          ref,
          actor
        )
        const composer = JSON.parse(composerFile.content)
        const compDeps = {
          ...(composer.require ?? {}),
          ...(composer["require-dev"] ?? {}),
        }
        if (compDeps["laravel/framework"]) {
          laravelVersion = String(compDeps["laravel/framework"])
        }
      }

      if (laravelVersion || fileExists("artisan")) {
        return {
          frameworkId: "laravel",
          frameworkName: "Laravel",
          frameworkVersion: laravelVersion,
          ecosystem: "php",
          confidence: 0.95,
          defaultPort: exposedPort ?? 80,
          startScript: "php artisan serve",
          runtimeId: "php",
          runtimeVersion: "8.2",
          envDefaults,
          reasons: ["composer.json or artisan CLI entrypoint found"],
          evidence: [
            {
              type: "file",
              value: fileExists("artisan") ? "artisan" : "composer.json",
              detail: laravelVersion
                ? `laravel/framework: ${laravelVersion}`
                : "artisan entrypoint",
            },
          ],
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Python check
  if (fileExists("requirements.txt") || fileExists("pyproject.toml")) {
    try {
      let content = ""
      if (fileExists("requirements.txt")) {
        const reqFile = await adapter.readFile(
          repoUrl,
          resolvePath("requirements.txt"),
          ref,
          actor
        )
        content = reqFile.content
      } else if (fileExists("pyproject.toml")) {
        const tomlFile = await adapter.readFile(
          repoUrl,
          resolvePath("pyproject.toml"),
          ref,
          actor
        )
        content = tomlFile.content
      }

      if (/django/i.test(content)) {
        return {
          frameworkId: "django",
          frameworkName: "Django",
          frameworkVersion: null,
          ecosystem: "python",
          confidence: 0.9,
          defaultPort: exposedPort ?? 8000,
          startScript: "python manage.py runserver",
          runtimeId: "python",
          runtimeVersion: "3.11",
          envDefaults,
          reasons: ["requirements.txt contains django"],
          evidence: [
            { type: "file", value: "requirements.txt", detail: "django" },
          ],
        }
      }

      if (/fastapi/i.test(content)) {
        return {
          frameworkId: "fastapi",
          frameworkName: "FastAPI",
          frameworkVersion: null,
          ecosystem: "python",
          confidence: 0.9,
          defaultPort: exposedPort ?? 8000,
          startScript: "uvicorn main:app --host 0.0.0.0 --port 8000",
          runtimeId: "python",
          runtimeVersion: "3.11",
          envDefaults,
          reasons: ["requirements.txt contains fastapi"],
          evidence: [
            { type: "file", value: "requirements.txt", detail: "fastapi" },
          ],
        }
      }

      if (/flask/i.test(content)) {
        return {
          frameworkId: "flask",
          frameworkName: "Flask",
          frameworkVersion: null,
          ecosystem: "python",
          confidence: 0.85,
          defaultPort: exposedPort ?? 5000,
          startScript: "python app.py",
          runtimeId: "python",
          runtimeVersion: "3.11",
          envDefaults,
          reasons: ["requirements.txt contains flask"],
          evidence: [
            { type: "file", value: "requirements.txt", detail: "flask" },
          ],
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Go check
  if (fileExists("go.mod")) {
    try {
      const goMod = await adapter.readFile(
        repoUrl,
        resolvePath("go.mod"),
        ref,
        actor
      )
      const isGin = /gin-gonic\/gin/i.test(goMod.content)
      return {
        frameworkId: isGin ? "gin" : "go",
        frameworkName: isGin ? "Gin" : "Go",
        frameworkVersion: null,
        ecosystem: "go",
        confidence: isGin ? 0.9 : 0.8,
        defaultPort: exposedPort ?? (isGin ? 8080 : 8080),
        startScript: "go run .",
        runtimeId: "go",
        runtimeVersion: "1.22",
        envDefaults,
        reasons: ["go.mod found"],
        evidence: [
          {
            type: "file",
            value: "go.mod",
            detail: isGin ? "gin-gonic/gin" : "Go module",
          },
        ],
      }
    } catch {
      // ignore
    }
  }

  // 5. Rust check
  if (fileExists("Cargo.toml")) {
    return {
      frameworkId: "rust",
      frameworkName: "Rust",
      frameworkVersion: null,
      ecosystem: "rust",
      confidence: 0.8,
      defaultPort: exposedPort ?? 8080,
      startScript: "cargo run --release",
      runtimeId: "rust",
      runtimeVersion: "1.78",
      envDefaults,
      reasons: ["Cargo.toml found"],
      evidence: [
        { type: "file", value: "Cargo.toml", detail: "Rust cargo package" },
      ],
    }
  }

  return {
    frameworkId: null,
    frameworkName: null,
    frameworkVersion: null,
    ecosystem: "unknown",
    confidence: 0,
    defaultPort: exposedPort,
    startScript: null,
    runtimeId: null,
    runtimeVersion: null,
    envDefaults,
    reasons: ["No recognized framework manifest found"],
    evidence: [],
  }
}

export async function inspectRepoWithAi(
  input: UniversalInspectionInput,
  externalDeps?: UniversalInspectionDependencies
): Promise<UniversalInspectionOutput> {
  const startTime = Date.now()
  const deps: UniversalInspectionDependencies = {
    ...input.dependencies,
    ...externalDeps,
  }

  const prismaClient = deps.db ?? prisma

  // 1. Resolve Git Provider Adapter
  let adapter: GitProviderAdapter
  try {
    const resolver = deps.resolveGitProvider ?? resolveGitProvider
    adapter = deps.adapter ?? resolver(input.repoUrl)
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Failed to resolve git provider"
    const decision: DetectionDecision = {
      status: "blocked",
      message: reason,
      isLaunchable: false,
    }
    const result: DetectionResult = {
      primaryFramework: null,
      requiredDependencies: [],
      alternatives: [],
      confidence: 0,
      decision,
      evidence: [],
      warnings: [reason],
      source: {
        repoUrl: input.repoUrl,
        ref: input.ref,
        subdir: input.subpath,
      },
    }

    if (input.sessionId && prismaClient?.aiDeploymentSession) {
      try {
        await prismaClient.aiDeploymentSession.update({
          where: { id: input.sessionId },
          data: { status: "BLOCKED" },
        })
      } catch {
        // Non-fatal session update failure
      }
    }

    if (prismaClient?.detectorInspectionLog) {
      try {
        const log = await prismaClient.detectorInspectionLog.create({
          data: {
            repoUrl: input.repoUrl,
            ref: input.ref ?? null,
            detectedFramework: null,
            confidence: 0,
            reasoning: [],
            warnings: result.warnings,
            status: "blocked",
            errorMessage: reason,
            durationMs: Date.now() - startTime,
          },
        })
        result.inspectionLogId = log.id
      } catch {
        // Non-fatal logging failure
      }
    }

    return {
      ...result,
      result,
      aiTrace: null,
    }
  }

  // 2. Check Git Provider Access
  const access = await adapter.checkAccess(input.repoUrl, input.actor)
  if (!access.accessible) {
    const reason =
      access.reason ?? "Repository access denied or requires authorization"
    const decision: DetectionDecision = {
      status: "blocked",
      message: reason,
      isLaunchable: false,
    }
    const result: DetectionResult = {
      primaryFramework: null,
      requiredDependencies: [],
      alternatives: [],
      confidence: 0,
      decision,
      evidence: [],
      warnings: [reason],
      source: {
        repoUrl: input.repoUrl,
        ref: input.ref,
        subdir: input.subpath,
      },
    }

    if (input.sessionId && prismaClient?.aiDeploymentSession) {
      try {
        await prismaClient.aiDeploymentSession.update({
          where: { id: input.sessionId },
          data: { status: "BLOCKED" },
        })
      } catch {
        // Non-fatal session update failure
      }
    }

    if (prismaClient?.detectorInspectionLog) {
      try {
        const log = await prismaClient.detectorInspectionLog.create({
          data: {
            repoUrl: input.repoUrl,
            ref: input.ref ?? null,
            detectedFramework: null,
            confidence: 0,
            reasoning: [],
            warnings: result.warnings,
            status: "blocked",
            errorMessage: reason,
            durationMs: Date.now() - startTime,
          },
        })
        result.inspectionLogId = log.id
      } catch {
        // Non-fatal logging failure
      }
    }

    return {
      ...result,
      result,
      aiTrace: null,
    }
  }

  // 3. Setup Policy Evaluator, AI Tools, and Trace
  const toolTraces: AiDetectionToolTrace[] = []
  const onStep = (traceItem: AiDetectionToolTrace) => {
    toolTraces.push(traceItem)
  }

  const evaluator = deps.evaluator ?? new DetectorRuleEvaluator()

  let treeFiles: string[] = []
  try {
    const tree = await adapter.listTree(
      input.repoUrl,
      input.ref,
      input.subpath,
      input.actor
    )
    treeFiles = tree.files
  } catch {
    treeFiles = []
  }

  const initialPolicy = await evaluator.evaluateRepositoryPolicy({
    files: treeFiles,
    db: prismaClient,
  })

  const modelName =
    deps.model ?? (process.env.AI_DETECTOR_MODEL?.trim() || "gpt-4.1-mini")
  let aiBaseUrlHost = "unknown"

  if (initialPolicy.isBlocked) {
    const explanation =
      initialPolicy.reason ||
      `Deployment blocked by rule: ${initialPolicy.ruleCode}`

    const isWp =
      initialPolicy.ruleCode === "RULE-BLOCK-WP-LEGACY" ||
      treeFiles.some((f) => f.includes("wp-"))

    const primaryFramework: DetectedFramework | null = isWp
      ? {
          id: "wordpress",
          name: "WordPress",
          ecosystem: "php",
          confidence: 0,
          reasons: [explanation],
        }
      : null

    const decision: DetectionDecision = {
      status: "blocked",
      message: explanation,
      isLaunchable: false,
    }

    const evidence: DetectionEvidence[] = [
      {
        type: "file",
        value: "blocked",
        detail: `Blocked by rule "${initialPolicy.ruleCode}": ${explanation}`,
      },
    ]

    const result: DetectionResult = {
      primaryFramework,
      requiredDependencies: [],
      alternatives: [],
      confidence: 0,
      decision,
      evidence,
      warnings: [explanation],
      source: {
        repoUrl: input.repoUrl,
        ref: input.ref,
        subdir: input.subpath,
      },
      blockedByRuleId: initialPolicy.ruleCode ?? null,
      policyEvaluation: initialPolicy,
      recommendations: initialPolicy.suggestedAlternatives ?? [],
    }

    if (input.sessionId && prismaClient?.aiDeploymentSession) {
      try {
        await prismaClient.aiDeploymentSession.update({
          where: { id: input.sessionId },
          data: { status: "BLOCKED" },
        })
      } catch {
        // Non-fatal
      }
    }

    toolTraces.push({
      name: "list_repo_files",
      inputSummary: { requestedPath: input.subpath },
      outcome: "completed",
      status: "completed",
      durationMs: 1,
      listedFileCount: treeFiles.length,
    })
    toolTraces.push({
      name: "evaluate_detector_rules",
      inputSummary: { fileCount: treeFiles.length },
      outcome: "completed",
      status: "completed",
      durationMs: 1,
      matchedRuleId: initialPolicy.ruleCode,
    })

    const aiTrace: AiDetectionTrace = {
      version: 1,
      terminalStage: "completed",
      elapsedMs: Date.now() - startTime,
      model: modelName,
      baseUrlHost: "platform-policy",
      tools: toolTraces,
    }

    if (prismaClient?.detectorInspectionLog) {
      try {
        const log = await prismaClient.detectorInspectionLog.create({
          data: {
            repoUrl: input.repoUrl,
            ref: input.ref ?? null,
            detectedFramework: result.primaryFramework?.id ?? null,
            confidence: 0,
            enforcedRuntimes: null as never,
            aiTrace: aiTrace as never,
            reasoning: result.primaryFramework?.reasons ?? [],
            warnings: result.warnings,
            durationMs: Date.now() - startTime,
            status: "blocked",
            blockedByRuleId: initialPolicy.ruleCode ?? null,
            errorMessage: explanation,
          },
        })
        result.inspectionLogId = log.id
      } catch {
        // Non-fatal
      }
    }

    return {
      ...result,
      result,
      aiTrace,
    }
  }

  const repoInspectorTools = createRepoInspectorTools({
    adapter,
    repoUrl: input.repoUrl,
    ref: input.ref,
    subpath: input.subpath,
    actor: input.actor,
    onStep,
  })

  const policyTool = evaluator.createPolicyEvaluationTool(prismaClient, {
    onStep,
  })

  const tools = {
    ...repoInspectorTools,
    evaluate_detector_rules: policyTool,
  }
  let aiFailed = false
  let aiDecision: AiInspectionDecision | null = null
  let aiErrorMessage: string | null = null

  try {
    const getAiConfig = deps.getAiConfig ?? getAiProviderConfig
    const aiConfig = getAiConfig()
    try {
      aiBaseUrlHost = new URL(aiConfig.baseURL).host
    } catch {
      aiBaseUrlHost = "unknown"
    }

    const createProvider = deps.createOpenAI ?? createOpenAI
    const generate = deps.generateText ?? generateText
    const provider = createProvider(aiConfig)

    const userPrompt = [
      `Repository: ${input.repoUrl}`,
      input.ref ? `Branch/Ref: ${input.ref}` : "Using default branch",
      input.subpath ? `Subdirectory: ${input.subpath}` : "",
      "",
      "Inspect repository manifests using list_repo_files and read_repo_file to identify the project framework and configurations.",
    ]
      .filter(Boolean)
      .join("\n")

    const aiResult = await generate({
      model: provider(modelName),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      tools,
      output: Output.object({ schema: AI_INSPECTION_DECISION_SCHEMA }),
      stopWhen: stepCountIs(16),
    })

    const rawDecision =
      (aiResult as unknown as { output?: unknown })?.output ??
      (aiResult as unknown as { object?: unknown })?.object ??
      ((aiResult as unknown as { text?: string })?.text
        ? JSON.parse((aiResult as unknown as { text: string }).text)
        : null)

    aiDecision = AI_INSPECTION_DECISION_SCHEMA.parse(rawDecision)
  } catch (error) {
    aiFailed = true
    aiErrorMessage =
      error instanceof Error ? error.message : "AI inspection failed"
  }

  // 4. Build DetectionResult (either from AI decision or deterministic fallback)
  let result: DetectionResult

  if (!aiFailed && aiDecision) {
    const isUnknown =
      !aiDecision.primaryFrameworkId ||
      aiDecision.primaryFrameworkId === "unknown"

    const primaryFramework: DetectedFramework | null = !isUnknown
      ? {
          id: aiDecision.primaryFrameworkId,
          name: aiDecision.frameworkName || aiDecision.primaryFrameworkId,
          ecosystem: aiDecision.ecosystem,
          confidence: aiDecision.confidence,
          reasons: aiDecision.reasoning,
        }
      : null

    const requiredDependencies: RequiredDependency[] =
      aiDecision.requiredRuntimeIds.map((runtimeId) => ({
        id: runtimeId,
        kind: "runtime",
        requiredFor: "app_runtime",
        confidence: aiDecision.confidence,
        reason: `Required by ${aiDecision.frameworkName || aiDecision.primaryFrameworkId}`,
      }))

    const isLaunchable =
      Boolean(primaryFramework) && aiDecision.confidence >= 0.6

    const decision: DetectionDecision = {
      status: isLaunchable
        ? "success"
        : primaryFramework
          ? "low_confidence"
          : "unsupported",
      message: isLaunchable
        ? `Successfully detected ${primaryFramework?.name}`
        : primaryFramework
          ? "Detection confidence is below recommended launch threshold"
          : "No supported framework detected",
      isLaunchable,
    }

    const enforcedRuntimes = aiDecision.requiredRuntimeIds.map((runtimeId) => ({
      runtimeId,
      version: aiDecision.runtimeVersion || "latest",
    }))

    const evidence: DetectionEvidence[] = [
      {
        type: "ai",
        value: aiDecision.primaryFrameworkId,
        detail: aiDecision.reasoning.join("; "),
      },
    ]

    result = {
      primaryFramework,
      requiredDependencies,
      alternatives: [],
      confidence: aiDecision.confidence,
      decision,
      evidence,
      warnings: aiDecision.warnings ?? [],
      source: {
        repoUrl: input.repoUrl,
        ref: input.ref,
        subdir: input.subpath,
      },
      frameworkVersion: aiDecision.frameworkVersion ?? null,
      defaultPort:
        aiDecision.defaultPort ??
        (aiDecision.primaryFrameworkId
          ? (DEFAULT_PORT_MAP[aiDecision.primaryFrameworkId] ?? null)
          : null),
      enforcedRuntimes,
      envDefaults: aiDecision.envDefaults ?? {},
    }
  } else {
    // Fall back gracefully to deterministic manifest inspection using adapter
    const deterministic = await runDeterministicManifestInspection({
      adapter,
      repoUrl: input.repoUrl,
      ref: input.ref,
      subpath: input.subpath,
      actor: input.actor,
    })

    const primaryFramework: DetectedFramework | null = deterministic.frameworkId
      ? {
          id: deterministic.frameworkId,
          name: deterministic.frameworkName ?? deterministic.frameworkId,
          ecosystem: deterministic.ecosystem,
          confidence: deterministic.confidence,
          reasons: deterministic.reasons,
        }
      : null

    const requiredDependencies: RequiredDependency[] = deterministic.runtimeId
      ? [
          {
            id: deterministic.runtimeId,
            kind: "runtime",
            requiredFor: "app_runtime",
            confidence: deterministic.confidence,
            reason: `Required by ${deterministic.frameworkName ?? deterministic.frameworkId}`,
          },
        ]
      : []

    const isLaunchable =
      Boolean(primaryFramework) && deterministic.confidence >= 0.6

    const decision: DetectionDecision = {
      status: isLaunchable
        ? "success"
        : primaryFramework
          ? "low_confidence"
          : "unsupported",
      message: isLaunchable
        ? `Successfully detected ${primaryFramework?.name}`
        : primaryFramework
          ? "Detection confidence is below recommended launch threshold"
          : "No supported framework detected",
      isLaunchable,
    }

    const enforcedRuntimes = deterministic.runtimeId
      ? [
          {
            runtimeId: deterministic.runtimeId,
            version: deterministic.runtimeVersion ?? "latest",
          },
        ]
      : []

    const warnings = [
      `AI provider unavailable (${aiErrorMessage ?? "unknown error"}); fell back to deterministic manifest inspection`,
    ]

    result = {
      primaryFramework,
      requiredDependencies,
      alternatives: [],
      confidence: deterministic.confidence,
      decision,
      evidence: deterministic.evidence,
      warnings,
      source: {
        repoUrl: input.repoUrl,
        ref: input.ref,
        subdir: input.subpath,
      },
      frameworkVersion: deterministic.frameworkVersion,
      defaultPort:
        deterministic.defaultPort ??
        (deterministic.frameworkId
          ? (DEFAULT_PORT_MAP[deterministic.frameworkId] ?? null)
          : null),
      enforcedRuntimes,
      envDefaults: deterministic.envDefaults,
    }
  }

  // 5. Evaluate Framework Policy if primaryFramework is detected
  if (result.primaryFramework?.id) {
    const frameworkPolicy = await evaluator.evaluateRepositoryPolicy({
      files: treeFiles,
      detectedFramework: result.primaryFramework.id,
      db: prismaClient,
    })
    if (frameworkPolicy.isBlocked) {
      const explanation =
        frameworkPolicy.reason ||
        `Deployment blocked by rule: ${frameworkPolicy.ruleCode}`
      result.decision = {
        status: "blocked",
        message: explanation,
        isLaunchable: false,
      }
      result.confidence = 0
      result.blockedByRuleId = frameworkPolicy.ruleCode ?? null
      result.policyEvaluation = frameworkPolicy
      result.recommendations = frameworkPolicy.suggestedAlternatives ?? []
      result.warnings.push(explanation)
      result.evidence.push({
        type: "file",
        value: "blocked",
        detail: `Blocked by rule "${frameworkPolicy.ruleCode}": ${explanation}`,
      })

      if (input.sessionId && prismaClient?.aiDeploymentSession) {
        try {
          await prismaClient.aiDeploymentSession.update({
            where: { id: input.sessionId },
            data: { status: "BLOCKED" },
          })
        } catch {
          // Non-fatal session update failure
        }
      }
    }
  }

  // 6. Build AI trace
  const aiTrace: AiDetectionTrace = {
    version: 1,
    terminalStage: aiFailed ? "provider" : "completed",
    elapsedMs: Date.now() - startTime,
    model: modelName,
    baseUrlHost: aiBaseUrlHost,
    tools: toolTraces,
  }

  // 7. Record audit log in Prisma DetectorInspectionLog
  if (prismaClient?.detectorInspectionLog) {
    try {
      const log = await prismaClient.detectorInspectionLog.create({
        data: {
          repoUrl: input.repoUrl,
          ref: input.ref ?? null,
          detectedFramework: result.primaryFramework?.id ?? null,
          confidence: result.confidence,
          enforcedRuntimes: (result.enforcedRuntimes ?? null) as never,
          aiTrace: aiTrace as never,
          reasoning: result.primaryFramework?.reasons ?? [],
          warnings: result.warnings,
          durationMs: Date.now() - startTime,
          status: result.decision.status,
          blockedByRuleId: result.blockedByRuleId ?? null,
          errorMessage:
            result.decision.status !== "success"
              ? result.decision.message
              : null,
        },
      })
      result.inspectionLogId = log.id
    } catch {
      // Non-fatal logging failure
    }
  }

  return {
    ...result,
    result,
    aiTrace,
  }
}
