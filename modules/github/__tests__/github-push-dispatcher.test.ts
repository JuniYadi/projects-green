import { beforeEach, describe, expect, it, mock } from "bun:test"
import { createHmac } from "node:crypto"

import {
  createJenkinsPushDispatcher,
  verifyGitHubSignature,
} from "../github-push-dispatcher"

let mockTriggerDeployError: Error | null = null

const mockStacks: Array<{ id: string; slug: string }> = [
  { id: "stack_1", slug: "my-repo" },
]

const mockPrisma = {
  applicationStack: {
    findMany: mock(async () => mockStacks),
  },
  applicationDeployment: {
    findFirst: mock(async () => null),
    count: mock(async () => 0),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/modules/deploy/deploy-pipeline.service", () => ({
  triggerDeploy: mock(async () => {
    if (mockTriggerDeployError) throw mockTriggerDeployError
    return { id: "deploy_1" }
  }),
}))

const makePayload = (overrides: Record<string, unknown> = {}) => ({
  ref: "refs/heads/main",
  after: "abc1234def5678",
  commits: [],
  pusher: { name: "johndoe", email: "john@example.com" },
  repository: {
    id: 1,
    full_name: "org/my-repo",
    name: "my-repo",
    owner: { login: "org" },
  },
  ...overrides,
})

describe("createJenkinsPushDispatcher", () => {
  beforeEach(() => {
    mockTriggerDeployError = null
    mockPrisma.applicationDeployment.findFirst.mockClear()
    mockPrisma.applicationDeployment.count.mockClear()
  })

  it("triggers deploy for matching stack", async () => {
    const dispatcher = createJenkinsPushDispatcher()

    const result = await dispatcher({
      webhookEventId: "evt_1",
      connectionId: "conn_1",
      branch: "main",
      payload: makePayload(),
    })

    expect(result).toEqual({ jobId: expect.stringContaining("my-repo/") })

    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryConnectionId: "conn_1",
          branchName: "main",
        },
      })
    )
  })

  it("returns a job ID with repo/sha format", async () => {
    const dispatcher = createJenkinsPushDispatcher()

    const result = await dispatcher({
      webhookEventId: "evt_2",
      connectionId: "conn_2",
      branch: "release",
      payload: makePayload({ after: "deadbeef1234567" }),
    })

    expect(result).toEqual({ jobId: expect.stringContaining("my-repo/") })
    expect(result.jobId).toContain("deadbee")
  })

  it("handles missing commit SHA gracefully", async () => {
    const dispatcher = createJenkinsPushDispatcher()

    const result = await dispatcher({
      webhookEventId: "evt_3",
      connectionId: "conn_3",
      branch: "main",
      payload: makePayload({ after: undefined }),
    })

    expect(result).toEqual({ jobId: "my-repo/unknown" })
  })

  it("handles unknown repository name", async () => {
    const dispatcher = createJenkinsPushDispatcher()

    const result = await dispatcher({
      webhookEventId: "evt_4",
      connectionId: "conn_4",
      branch: "main",
      payload: makePayload({ repository: undefined }),
    })

    expect(result).toEqual({ jobId: "unknown/abc1234" })
  })

  it("handles trigger failure gracefully (no throw)", async () => {
    mockTriggerDeployError = new Error("Deploy failed")

    const dispatcher = createJenkinsPushDispatcher()

    const result = await dispatcher({
      webhookEventId: "evt_5",
      connectionId: "conn_5",
      branch: "main",
      payload: makePayload(),
    })

    // Dispatcher catches errors in triggerDeploy, returns null jobId
    expect(result).toEqual({ jobId: null })
  })
})

describe("verifyGitHubSignature", () => {
  it("returns false when signature is null", () => {
    expect(verifyGitHubSignature("body", null, "secret")).toBe(false)
  })

  it("returns false when signature is undefined", () => {
    expect(verifyGitHubSignature("body", undefined, "secret")).toBe(false)
  })

  it("returns false when payload is empty", () => {
    expect(verifyGitHubSignature("", "sig", "secret")).toBe(false)
  })

  it("returns false when secret is empty", () => {
    expect(verifyGitHubSignature("body", "sig", "")).toBe(false)
  })

  it("returns true for valid signature", () => {
    const secret = "test-secret"
    const payload = "test-payload"
    const hmac = createHmac("sha256", secret)
    const digest = "sha256=" + hmac.update(payload).digest("hex")

    expect(verifyGitHubSignature(payload, digest, secret)).toBe(true)
  })

  it("returns false for invalid signature", () => {
    expect(verifyGitHubSignature("body", "sha256=invalid", "secret")).toBe(
      false
    )
  })
})
