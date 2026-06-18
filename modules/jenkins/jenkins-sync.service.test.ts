import { describe, expect, test, mock, beforeEach } from "bun:test"

// Mock the GitHub service before importing the module under test
const mockCommitFileToRepo = mock(() =>
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

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.owner).toBe("pfnapp")
    expect(call.repo).toBe("Jenkins")
    expect(call.filePath).toBe("jobs/pfnapp/app-test-dev.groovy")
    expect(call.message).toBe("feat: add Jenkins pipeline for app-test-dev")
    expect(call.content).toContain("laravelPipeline")
    expect(call.content).toContain("app-test-dev")
  })

  test("maps Next.js framework to Node pipeline", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "nextjs",
    })

    expect(result.pipelineType).toBe("node")

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.content).toContain("nodejsPipeline")
  })

  test("maps Bun framework to Node pipeline", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "bun",
    })

    expect(result.pipelineType).toBe("node")

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.content).toContain("nodejsPipeline")
  })

  test("maps Docker framework to Docker pipeline", async () => {
    const result = await syncJenkinsPipeline({
      ...baseInput,
      framework: "docker",
    })

    expect(result.pipelineType).toBe("docker")

    const call = mockCommitFileToRepo.mock.calls[0][0]
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

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.owner).toBe("custom-org")
    expect(call.repo).toBe("CustomJenkins")
  })

  test("uses custom git credential ID", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
      gitCredentialId: "custom-token",
    })

    const call = mockCommitFileToRepo.mock.calls[0][0]
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

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.filePath).toBe("jobs/pfnapp/app-my-cool-app-prod.groovy")
  })

  test("includes repo URL in DSL content", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      framework: "laravel",
    })

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.content).toContain("https://github.com/pfnapp/pfnapp")
  })

  test("includes branch in DSL content", async () => {
    await syncJenkinsPipeline({
      ...baseInput,
      branch: "develop",
      framework: "node",
    })

    const call = mockCommitFileToRepo.mock.calls[0][0]
    expect(call.content).toContain("develop")
  })
})
