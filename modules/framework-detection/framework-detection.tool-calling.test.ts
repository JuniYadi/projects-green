import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  detectFrameworkFromGithubApi,
  type GithubApiDetectorDependencies,
} from "@/modules/framework-detection/framework-detection.service"

const generateTextMock = mock(async () => ({ output: {} }))
const createOpenAIMock = mock(() => mock(() => "mock-model"))

type ToolDefinition = {
  execute: (input: Record<string, string>) => Promise<unknown>
}

type GenerateTextInput = {
  tools: Record<string, ToolDefinition>
}

const aiDecision = {
  primaryFrameworkId: "nextjs",
  confidence: 0.92,
  requiredRuntimeIds: ["node"],
  reasoning: ["next dependency found"],
}

const createDependencies = (
  overrides: Partial<GithubApiDetectorDependencies> = {}
) => {
  const logCreate = mock(async () => ({ id: "trace-log-1" }))

  return {
    dependencies: {
      listFiles: async () => ({
        files: ["package.json", "next.config.mjs"],
        truncated: false,
      }),
      readFile: async ({ filePath }) => ({
        content:
          filePath === "package.json"
            ? JSON.stringify({ dependencies: { next: "16.1.0" } })
            : "",
        path: filePath,
        sha: "sha",
        size: 100,
      }),
      prisma: {
        detectorRule: { findMany: async () => [] },
        detectorRuntimeMapping: { findMany: async () => [] },
        detectorInspectionLog: { create: logCreate },
      },
      createOpenAI:
        createOpenAIMock as GithubApiDetectorDependencies["createOpenAI"],
      generateText:
        generateTextMock as GithubApiDetectorDependencies["generateText"],
      ...overrides,
    } satisfies GithubApiDetectorDependencies,
    logCreate,
  }
}

describe("production AI tool-calling trace", () => {
  beforeEach(() => {
    process.env.AI_API_KEY = "test-key"
    generateTextMock.mockClear()
    createOpenAIMock.mockClear()
    generateTextMock.mockResolvedValue({ output: aiDecision })
  })

  it("records redacted completed tool steps from the production adapter", async () => {
    generateTextMock.mockImplementationOnce(
      async ({ tools }: GenerateTextInput) => {
        await tools.list_repo_files.execute({ path: "\u0000src" })
        await tools.read_repo_file.execute({ filePath: "package.json" })

        return { output: aiDecision }
      }
    )
    const { dependencies, logCreate } = createDependencies()

    await detectFrameworkFromGithubApi(
      { installationId: 123, owner: "org", repo: "repo" },
      dependencies
    )

    expect(createOpenAIMock).toHaveBeenCalledTimes(1)
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    const logData = logCreate.mock.calls[0]?.[0]?.data
    expect(logData.aiTrace).toMatchObject({
      version: 1,
      terminalStage: "completed",
      tools: [
        {
          name: "list_repo_files",
          inputSummary: { requestedPath: "src" },
          outcome: "completed",
          listedFileCount: 2,
        },
        {
          name: "read_repo_file",
          inputSummary: { requestedPath: "package.json" },
          outcome: "completed",
        },
      ],
    })
    expect(JSON.stringify(logData.aiTrace)).not.toContain("16.1.0")
  })

  it("persists a failed tool step and uses the deterministic fallback", async () => {
    let readCount = 0
    const { dependencies, logCreate } = createDependencies({
      readFile: async ({ filePath }) => {
        readCount += 1
        if (readCount > 1) throw new Error("GitHub read failed")
        return {
          content: JSON.stringify({ dependencies: { next: "16.1.0" } }),
          path: filePath,
          sha: "sha",
          size: 100,
        }
      },
    })
    generateTextMock.mockImplementationOnce(
      async ({ tools }: GenerateTextInput) => {
        await tools.read_repo_file.execute({ filePath: "package.json" })
        return { output: aiDecision }
      }
    )

    const result = await detectFrameworkFromGithubApi(
      { installationId: 123, owner: "org", repo: "repo" },
      dependencies
    )

    expect(result.primaryFramework?.id).toBe("nextjs")
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    const logData = logCreate.mock.calls[0]?.[0]?.data
    expect(logData.aiTrace).toMatchObject({
      terminalStage: "tool",
      tools: [
        {
          name: "read_repo_file",
          inputSummary: { requestedPath: "package.json" },
          outcome: "failed",
          errorCategory: "tool_failure",
        },
      ],
    })
    expect(JSON.stringify(logData.aiTrace)).not.toContain("GitHub read failed")
  })
})
