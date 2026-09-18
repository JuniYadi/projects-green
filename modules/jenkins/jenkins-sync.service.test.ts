import { describe, expect, test, mock, beforeEach } from "bun:test"
import type { CommitFileResult } from "@/modules/github/github.service"

type CommitFileInput = {
  installationId: number
  owner: string
  repo: string
  filePath: string
  content: string
  message: string
  branch?: string
}

// Mock the GitHub service before importing the module under test
const mockCommitFileToRepo = mock((): Promise<CommitFileResult> =>
  Promise.resolve({
    commitSha: "abc123",
    filePath: "jobs/pfnapp/app-test-dev.groovy",
    action: "created" as const,
  })
)

mock.module("@/modules/github/github.service", () => ({
  commitFileToRepo: mockCommitFileToRepo,
}))

const { syncJenkinsPipeline } = await import("./jenkins-sync.service")

function getMockCall(): CommitFileInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = mockCommitFileToRepo.mock.calls as any[]
  return calls[0]?.[0] as CommitFileInput
}

describe("syncJenkinsPipeline", () => {
  beforeEach(() => {
    mockCommitFileToRepo.mockClear()
    mockCommitFileToRepo.mockImplementation(() =>
      Promise.resolve({
        commitSha: "abc123",
        filePath: "jobs/pfnapp/app-test-dev.groovy",
        action: "created" as const,
      })
    )
  })

  const baseInput = {
    installationId: 12345,
    owner: "pfnapp",
    repo: "pfnapp",
    slug: "app-test-dev",
    branch: "main",
    env: "dev" as const,
  }

  test("maps Laravel framework to PHP pipeline", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
    })

    expect(result.pipelineType).toBe("php")
    expect(result.action).toBe("created")
    expect(mockCommitFileToRepo).toHaveBeenCalledTimes(1)

    const call = getMockCall()
    expect(call.owner).toBe("pfnapp")
    expect(call.repo).toBe("Jenkins")
    expect(call.filePath).toBe("jobs/pfnapp/app-test-dev.groovy")
    expect(call.message).toBe("feat: add Jenkins pipeline for app-test-dev")
    expect(call.content).toContain("laravelPipelineV2([")
    expect(call.content).toContain("app-test-dev")
  })

  test("normalizes versioned Laravel framework to PHP pipeline", async () => {
    const result13 = await syncJenkinsPipeline({
      ...baseInput,
      framework: "Laravel 13.x",
    })
    expect(result13.pipelineType).toBe("php")
    let call = getMockCall()
    expect(call.content).toContain("laravelPipelineV2([")

    mockCommitFileToRepo.mockClear()
    const result11 = await syncJenkinsPipeline({
      ...baseInput,
      framework: "Laravel 11.x",
    })
    expect(result11.pipelineType).toBe("php")
    call = getMockCall()
    expect(call.content).toContain("laravelPipelineV2([")
  })

  test("maps Next.js framework to Node pipeline with nextjs default", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "nextjs",
    })

    expect(result.pipelineType).toBe("node")

    const call = getMockCall()
    expect(call.content).toContain("nodejsPipelineV2([")
    expect(call.content).toContain("frameworkDefault: 'nextjs'")
  })

  test("normalizes versioned Next.js framework to Node pipeline with nextjs default", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "Next.js 15",
    })

    expect(result.pipelineType).toBe("node")

    const call = getMockCall()
    expect(call.content).toContain("nodejsPipelineV2([")
    expect(call.content).toContain("frameworkDefault: 'nextjs'")
  })

  test("normalizes plain Next.js framework", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "Next.js",
    })

    expect(result.pipelineType).toBe("node")

    const call = getMockCall()
    expect(call.content).toContain("nodejsPipelineV2([")
    expect(call.content).toContain("frameworkDefault: 'nextjs'")
  })

  test("maps Bun framework to Node pipeline with nodejs default", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "bun",
    })

    expect(result.pipelineType).toBe("node")

    const call = getMockCall()
    expect(call.content).toContain("nodejsPipelineV2([")
    expect(call.content).toContain("frameworkDefault: 'nodejs'")
  })

  test("maps Docker framework to Docker pipeline", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "docker",
    })

    expect(result.pipelineType).toBe("docker")

    const call = getMockCall()
    expect(call.content).toContain("dockerPipeline")
  })

  test("throws on unsupported framework", async () => {
    await expect(
      syncJenkinsPipeline({
        ...baseInput,
        framework: "python",
      })
    ).rejects.toThrow('Unsupported framework "python"')
  })

  test("uses custom jenkins owner and repo", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
      jenkinsOwner: "custom-org",
      jenkinsRepo: "CustomJenkins",
    })

    const call = getMockCall()
    expect(call.owner).toBe("custom-org")
    expect(call.repo).toBe("CustomJenkins")
  })

  test("uses custom git credential ID", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
      gitCredentialId: "custom-token",
    })

    const call = getMockCall()
    expect(call.content).toContain("custom-token")
  })

  test("returns updated action when file exists", async () => {
    mockCommitFileToRepo.mockImplementationOnce(() =>
      Promise.resolve({
        commitSha: "def456",
        filePath: "jobs/pfnapp/app-test-dev.groovy",
        action: "updated" as const,
      })
    )

    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
    })

    expect(result.action).toBe("updated")
  })

  test("generates correct file path", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      slug: "app-my-cool-app-prod",
      framework: "node",
      env: "prod",
    })

    const call = getMockCall()
    expect(call.filePath).toBe("jobs/pfnapp/app-my-cool-app-prod.groovy")
  })

  test("includes repo URL in DSL content", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
    })

    const call = getMockCall()
    expect(call.content).toContain("https://github.com/pfnapp/pfnapp")
  })

  test("uses explicit gitRepoUrl when provided", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
      gitRepoUrl: "https://gitlab.com/custom/project.git",
    })

    const call = getMockCall()
    expect(call.content).toContain("https://gitlab.com/custom/project.git")
  })

  test("includes branch in DSL content", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      branch: "develop",
      framework: "node",
    })

    const call = getMockCall()
    expect(call.content).toContain("develop")
  })
})
