import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindManyLogs = mock(async () => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationDeploymentLog: {
      findMany: mockFindManyLogs,
    },
  },
}))

const mockResolveClusterIntegration = mock(async () => null)

mock.module("./cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
}))

import { getDeploymentJenkinsLog } from "./jenkins-stream.service"

describe("jenkins-stream.service", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    mockResolveClusterIntegration.mockReset()
    mockFindManyLogs.mockReset()
    mockFindManyLogs.mockResolvedValue([])
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("returns jenkins console text when cluster integration is active", async () => {
    mockResolveClusterIntegration.mockResolvedValueOnce({
      baseUrl: "https://jenkins.example.com",
      username: "admin",
      apiToken: "token123",
    } as never)

    globalThis.fetch = mock(async () => {
      return new Response("[Pipeline] Start of Pipeline\nBuild complete", {
        status: 200,
      })
    }) as unknown as typeof globalThis.fetch

    const result = await getDeploymentJenkinsLog({
      stack: { id: "stack-1", slug: "my-app" },
      deployment: {
        id: "deploy-1",
        status: "BUILDING",
        attempt: 1,
        events: [
          {
            type: "JENKINS_BUILD_RUNNING",
            metadataJson: { buildNumber: 5 },
            createdAt: new Date(),
          },
        ],
      },
    })

    expect(result.ok).toBe(true)
    expect(result.text).toContain("[Pipeline] Start of Pipeline")
    expect(result.buildNumber).toBe(5)
    expect(result.isBuilding).toBe(true)
  })

  it("returns JENKINS_AUTH_FAILED when Jenkins returns 401", async () => {
    mockResolveClusterIntegration.mockResolvedValueOnce({
      baseUrl: "https://jenkins.example.com",
      username: "admin",
      apiToken: "badtoken",
    } as never)

    globalThis.fetch = mock(async () => {
      return new Response("Unauthorized", {
        status: 401,
        statusText: "Unauthorized",
      })
    }) as unknown as typeof globalThis.fetch

    const result = await getDeploymentJenkinsLog({
      stack: { id: "stack-1", slug: "my-app" },
      deployment: {
        id: "deploy-1",
        status: "BUILDING",
        attempt: 1,
      },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe("JENKINS_AUTH_FAILED")
    expect(result.status).toBe("failed")
  })

  it("returns waiting executor message when Jenkins returns 404 for queued/building job", async () => {
    mockResolveClusterIntegration.mockResolvedValueOnce({
      baseUrl: "https://jenkins.example.com",
      username: "admin",
      apiToken: "token123",
    } as never)

    globalThis.fetch = mock(async () => {
      return new Response("Not Found", { status: 404 })
    }) as unknown as typeof globalThis.fetch

    const result = await getDeploymentJenkinsLog({
      stack: { id: "stack-1", slug: "my-app" },
      deployment: {
        id: "deploy-1",
        status: "BUILDING",
        attempt: 1,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.text).toContain(
      "Waiting for Jenkins runner to allocate executor"
    )
    expect(result.isBuilding).toBe(true)
  })

  it("falls back to deployment logs when Jenkins integration is unconfigured", async () => {
    mockResolveClusterIntegration.mockResolvedValueOnce(null as never)
    mockFindManyLogs.mockResolvedValueOnce([
      { id: "1", scope: "build", status: "building", message: "Step 1 done" },
    ] as never)

    const result = await getDeploymentJenkinsLog({
      stack: { id: "stack-1", slug: "my-app" },
      deployment: {
        id: "deploy-1",
        status: "BUILDING",
        attempt: 1,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.text).toBe("[BUILD] Step 1 done")
  })
})
