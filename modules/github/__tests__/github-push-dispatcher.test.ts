import { beforeEach, describe, expect, it, mock } from "bun:test"
import { createHmac } from "node:crypto"

import {
  createJenkinsPushDispatcher,
  verifyGitHubSignature,
} from "../github-push-dispatcher"

const jenkinsCalls: Array<{
  jobName: string
  parameters: Record<string, string | number | boolean>
}> = []
let jenkinsShouldReject = false
let jenkinsRejectError: Error | null = null

mock.module("@/modules/jenkins/jenkins.service", () => ({
  triggerJenkinsJob: mock(
    (
      jobName: string,
      parameters: Record<string, string | number | boolean> = {}
    ) => {
      jenkinsCalls.push({ jobName, parameters })

      if (jenkinsShouldReject && jenkinsRejectError) {
        return Promise.reject(jenkinsRejectError)
      }

      return Promise.resolve()
    }
  ),
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
    jenkinsCalls.length = 0
    jenkinsShouldReject = false
    jenkinsRejectError = null
  })

  it("triggers Jenkins job with correct parameters", async () => {
    const dispatcher = createJenkinsPushDispatcher()

    await dispatcher({
      webhookEventId: "evt_1",
      connectionId: "conn_1",
      branch: "main",
      payload: makePayload(),
    })

    expect(jenkinsCalls).toEqual([
      {
        jobName: "deploy-my-repo",
        parameters: {
          GIT_REF: "main",
          GIT_COMMIT: "abc1234def5678",
          PUSHER: "johndoe",
          STACK_ID: "conn_1",
          WEBHOOK_EVENT_ID: "evt_1",
        },
      },
    ])
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

  it("re-throws when Jenkins job trigger fails", async () => {
    jenkinsShouldReject = true
    jenkinsRejectError = new Error("Jenkins unreachable")

    const dispatcher = createJenkinsPushDispatcher()

    await expect(
      dispatcher({
        webhookEventId: "evt_5",
        connectionId: "conn_5",
        branch: "main",
        payload: makePayload(),
      })
    ).rejects.toThrow("Jenkins unreachable")
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
    expect(verifyGitHubSignature("body", "sha256=invalid", "secret")).toBe(false)
  })
})
