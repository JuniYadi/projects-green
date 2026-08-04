import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  detectFrameworkFromGithubApi,
  type DetectorRuleRecord,
  type GithubApiDetectorDependencies,
  type RuntimeMappingRecord,
} from "@/modules/framework-detection/framework-detection.service"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"
import type {
  ListRepoFilesInput,
  ReadRepoFileInput,
} from "@/modules/github/github.service"

const REPOSITORY_URL = "https://github.com/laravel/laravel"
const OWNER = "laravel"
const REPOSITORY = "laravel"
const REF = "13.x"
const MAX_FILE_BYTES = 256 * 1024

type InspectionLog = Record<string, unknown>
type Scenario = {
  name: string
  resolveWithAiToolCalling: NonNullable<
    GithubApiDetectorDependencies["resolveWithAiToolCalling"]
  >
}
type ScenarioSummary = {
  framework: string | undefined
  laravelEvidence: boolean
  phpRuntime: string | undefined
  decision: DetectionResult["decision"]["status"]
}

const rules: DetectorRuleRecord[] = [
  {
    id: "support-laravel-launch",
    name: "Support Laravel Launch",
    description: null,
    patternJson: { frameworkId: "laravel" },
    implicationsJson: {
      impact: "LAUNCH",
      framework: "laravel",
      minConfidence: 0.8,
    },
    confidenceWeight: 1,
    isActive: true,
    priority: 100,
  },
]

const runtimeMappings: RuntimeMappingRecord[] = [
  {
    id: "laravel-php-runtime",
    frameworkId: "laravel",
    frameworkVersion: null,
    runtimeId: "php",
    runtimeVersion: "8.3",
    buildVersion: null,
    isActive: true,
    priority: 100,
  },
]

const runGitClone = async (destination: string) => {
  const process = Bun.spawn(
    [
      "git",
      "clone",
      "--depth=1",
      "--branch",
      REF,
      "--single-branch",
      `${REPOSITORY_URL}.git`,
      destination,
    ],
    { stdout: "ignore", stderr: "ignore" }
  )
  const exitCode = await process.exited
  if (exitCode !== 0) throw new Error(`Unable to clone ${OWNER}/${REPOSITORY}`)
}

const listLocalFiles = async (root: string) => {
  const files: string[] = []
  const visit = async (directory: string, relativeDirectory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath, relativePath)
      } else if (entry.isFile()) {
        files.push(relativePath)
      }
    }
  }
  await visit(root, "")
  return files.sort()
}

const createLocalAdapters = async (root: string) => {
  const listFiles = async (_input: ListRepoFilesInput) => ({
    files: await listLocalFiles(root),
    truncated: false,
  })

  const readFileAdapter = async ({ filePath }: ReadRepoFileInput) => {
    const relativePath = path.posix.normalize(filePath).replace(/^\.\//, "")
    if (
      !relativePath ||
      relativePath.startsWith("../") ||
      relativePath.includes("/../") ||
      path.posix.isAbsolute(relativePath)
    ) {
      throw new Error("Invalid local repository file path")
    }
    const fullPath = path.join(root, ...relativePath.split("/"))
    const fileStat = await stat(fullPath)
    if (!fileStat.isFile() || fileStat.size > MAX_FILE_BYTES) {
      throw new Error("Local repository file exceeds validator read limit")
    }
    const content = await readFile(fullPath, "utf8")
    return {
      content,
      path: filePath,
      sha: "local",
      size: Buffer.byteLength(content),
    }
  }

  return { listFiles, readFile: readFileAdapter }
}

const createPrisma = (inspectionLogs: InspectionLog[]) => ({
  detectorRule: {
    findMany: async () => rules,
  },
  detectorRuntimeMapping: {
    findMany: async () => runtimeMappings,
  },
  detectorInspectionLog: {
    create: async ({ data }: { data: InspectionLog }) => {
      inspectionLogs.push(data)
      return { id: `local-inspection-${inspectionLogs.length}` }
    },
  },
})

const scenarios: Scenario[] = [
  {
    name: "provider-failure fallback",
    resolveWithAiToolCalling: async () => {
      throw new Error("Provider returned error")
    },
  },
  {
    name: "valid provider",
    resolveWithAiToolCalling: async () => ({
      decision: {
        primaryFrameworkId: "laravel",
        frameworkVersion: "13.x",
        ecosystem: "php" as const,
        confidence: 0.99,
        requiredRuntimeIds: ["php" as const],
        reasoning: [
          "composer.json declares laravel/framework and artisan confirms Laravel application.",
        ],
      },
      toolCalls: [],
    }),
  },
]

const assertResult = (
  scenario: string,
  result: DetectionResult
): ScenarioSummary => {
  const hasLaravelEvidence =
    result.evidence.some(
      (entry) =>
        entry.value === "artisan" ||
        entry.value === "composer.json" ||
        entry.value === "laravel/framework"
    ) ||
    (result.primaryFramework?.reasons.some((reason) =>
      /laravel|artisan|composer/i.test(reason)
    ) ??
      false)
  const hasPhpRuntime = result.enforcedRuntimes?.some(
    (runtime) => runtime.runtimeId === "php" && runtime.version !== "unknown"
  )
  const failures = [
    result.primaryFramework?.id !== "laravel" &&
      "primary framework is not Laravel",
    !hasLaravelEvidence && "Laravel evidence is missing",
    !hasPhpRuntime && "PHP runtime is not enforced",
    result.decision.status !== "success" &&
      `launch decision is ${result.decision.status}`,
  ].filter((failure): failure is string => Boolean(failure))
  if (failures.length > 0) {
    throw new Error(`${scenario}: ${failures.join("; ")}`)
  }
  return {
    framework: result.primaryFramework?.id,
    laravelEvidence: hasLaravelEvidence,
    phpRuntime: result.enforcedRuntimes?.find(
      (runtime) => runtime.runtimeId === "php"
    )?.version,
    decision: result.decision.status,
  }
}

const run = async () => {
  console.log("Phase 1/4: Clone Laravel 13.x")
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "projects-green-ai-"))
  try {
    await runGitClone(temporaryRoot)

    console.log("Phase 2/4: Prepare local GitHub adapters and runtime policy")
    const adapters = await createLocalAdapters(temporaryRoot)
    const inspectionLogs: InspectionLog[] = []
    const prisma = createPrisma(inspectionLogs)

    console.log("Phase 3/4: Run detector scenarios")
    const summaries: ScenarioSummary[] = []
    for (const scenario of scenarios) {
      const dependencies: GithubApiDetectorDependencies = {
        ...adapters,
        resolveWithAiToolCalling: scenario.resolveWithAiToolCalling,
        prisma,
      }
      const result = await detectFrameworkFromGithubApi(
        {
          installationId: 0,
          owner: OWNER,
          repo: REPOSITORY,
          ref: REF,
        },
        dependencies
      )
      summaries.push(assertResult(scenario.name, result))
    }

    console.log("Phase 4/4: Validation summary")
    for (const [index, summary] of summaries.entries()) {
      console.log(
        `${scenarios[index]?.name}: framework=${summary.framework}; evidence=${summary.laravelEvidence}; php=${summary.phpRuntime}; decision=${summary.decision}`
      )
    }
    console.log(`Inspection logs captured: ${inspectionLogs.length}`)
    console.log("AI detection validation passed")
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

try {
  await run()
} catch (error) {
  console.error(
    `AI detection validation failed: ${
      error instanceof Error ? error.message : "unknown error"
    }`
  )
  process.exitCode = 1
}
