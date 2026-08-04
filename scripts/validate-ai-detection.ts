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
  expectedEvidence: "github-deterministic-fallback" | "tool-calling-detection"
  resolveWithAiToolCalling: NonNullable<
    GithubApiDetectorDependencies["resolveWithAiToolCalling"]
  >
}
type ScenarioSummary = {
  framework: string | undefined
  laravelEvidence: boolean
  evidenceValues: string[]
  enforcedRuntimes: string[]
  warningCategories: string[]
  phpRuntime: string | undefined
  decision: DetectionResult["decision"]["status"]
}

const SANITIZED_EVIDENCE_VALUES: Record<string, true> = {
  artisan: true,
  "composer.json": true,
  "laravel/framework": true,
  "github-deterministic-fallback": true,
  "tool-calling-detection": true,
  "runtime-mapping-enforced": true,
}

const sanitizeWarningCategory = (warning: string) => {
  if (/fallback/i.test(warning)) return "fallback"
  if (/provider/i.test(warning)) return "provider"
  if (/truncated/i.test(warning)) return "truncated-listing"
  if (/inspection/i.test(warning)) return "inspection-log"
  return "other"
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
    expectedEvidence: "github-deterministic-fallback",
    resolveWithAiToolCalling: async () => {
      throw new Error("Provider returned error")
    },
  },
  {
    name: "valid provider",
    expectedEvidence: "tool-calling-detection",
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
  scenario: Scenario,
  result: DetectionResult
): ScenarioSummary => {
  const hasExpectedEvidence = result.evidence.some(
    (entry) => entry.value === scenario.expectedEvidence
  )
  const hasLocalLaravelEvidence = result.evidence.some(
    (entry) =>
      entry.value === "artisan" ||
      entry.value === "composer.json" ||
      entry.value === "laravel/framework"
  )
  const hasLaravelEvidence =
    result.primaryFramework?.id === "laravel" &&
    hasExpectedEvidence &&
    (scenario.expectedEvidence !== "github-deterministic-fallback" ||
      hasLocalLaravelEvidence)
  const hasPhpRuntime = result.enforcedRuntimes?.some(
    (runtime) => runtime.runtimeId === "php" && runtime.version !== "unknown"
  )
  const evidenceValues = [
    ...new Set(
      result.evidence.map((entry) =>
        SANITIZED_EVIDENCE_VALUES[entry.value] ? entry.value : "other"
      )
    ),
  ]
  const enforcedRuntimes = (result.enforcedRuntimes ?? []).map((runtime) => {
    const runtimeId = runtime.runtimeId.replace(/[^a-z0-9_-]/gi, "?")
    const version = runtime.version.replace(/[^a-z0-9.*+_-]/gi, "?")
    return `${runtimeId}=${version}`
  })
  const warningCategories = result.warnings.length
    ? [...new Set(result.warnings.map(sanitizeWarningCategory))]
    : ["none"]
  const failures = [
    result.primaryFramework?.id !== "laravel" &&
      "primary framework is not Laravel",
    !hasExpectedEvidence &&
      `missing expected evidence ${scenario.expectedEvidence}`,
    !hasLaravelEvidence && "Laravel evidence is missing",
    !hasPhpRuntime && "PHP runtime is not enforced",
    result.decision.status !== "success" &&
      `launch decision is ${result.decision.status}`,
    result.decision.isLaunchable !== true &&
      "launch decision is not launchable",
  ].filter((failure): failure is string => Boolean(failure))
  if (failures.length > 0) {
    throw new Error(`${scenario.name}: ${failures.join("; ")}`)
  }
  return {
    framework: result.primaryFramework?.id,
    laravelEvidence: hasLaravelEvidence,
    evidenceValues,
    enforcedRuntimes,
    warningCategories,
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
      summaries.push(assertResult(scenario, result))
    }

    console.log("Phase 4/4: Validation summary")
    for (const [index, summary] of summaries.entries()) {
      console.log(
        `${scenarios[index]?.name}: framework=${summary.framework}; evidence=${summary.evidenceValues.join(",")}; runtimes=${summary.enforcedRuntimes.join(",")}; warnings=${summary.warningCategories.join(",")}; decision=${summary.decision}; launchable=true`
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
