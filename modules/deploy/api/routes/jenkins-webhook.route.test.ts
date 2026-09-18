import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const mockStackFindFirst = mock(() => Promise.resolve(null))
const mockDeploymentFindFirst = mock(() => Promise.resolve(null))
const mockDeploymentUpdate = mock(() => Promise.resolve({}))
const mockStackUpdate = mock(() => Promise.resolve({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationStack: {
      findFirst: mockStackFindFirst,
      update: mockStackUpdate,
    },
    applicationDeployment: {
      findFirst: mockDeploymentFindFirst,
      update: mockDeploymentUpdate,
    },
  },
}))

const mockRecordDeployEventOnce = mock(() => Promise.resolve({}))
const mockRecordDeployLog = mock(() => Promise.resolve({}))
mock.module("../../deploy-event.service", () => ({
  recordDeployEventOnce: mockRecordDeployEventOnce,
  recordDeployLog: mockRecordDeployLog,
}))

const mockResolveClusterIntegration = mock(
  async (_stackId: string, type: string) => {
    if (type === "JENKINS") {
      return { webhookToken: "cluster-token" }
    }
    throw new Error("missing " + type)
  }
)
mock.module("../../cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
}))

import {
  createJenkinsHmacSignature,
  createJenkinsWebhookHeaders,
} from "../../jenkins-webhook-auth"

const { deployJenkinsWebhookRoutes } =
  await import("./jenkins-webhook.route")

describe("deploy jenkins-webhook.route", () => {
  let app: { handle: (req: Request) => Promise<Response> }
  const originalToken = process.env.JENKINS_WEBHOOK_TOKEN

  const post = (
    body: Record<string, unknown>,
    headers?: Record<string, string>,
    rawBodyOverride?: string
  ) => {
    const bodyText = rawBodyOverride ?? JSON.stringify(body)
    return app.handle(
      new Request("http://localhost/deploy/jenkins-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: bodyText,
      })
    )
  }

  beforeEach(() => {
    process.env.JENKINS_WEBHOOK_TOKEN = "secret-token"
    mockStackFindFirst.mockClear()
    mockDeploymentFindFirst.mockClear()
    mockDeploymentUpdate.mockClear()
    mockStackUpdate.mockClear()
    mockRecordDeployEventOnce.mockClear()
    mockRecordDeployLog.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "JENKINS") {
          return { webhookToken: "cluster-token" }
        }
        throw new Error("missing " + type)
      }
    )
    app = deployJenkinsWebhookRoutes as unknown as {
      handle: (req: Request) => Promise<Response>
    }
  })

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.JENKINS_WEBHOOK_TOKEN
    } else {
      process.env.JENKINS_WEBHOOK_TOKEN = originalToken
    }
  })

  it("returns 401 on missing HMAC signature headers", async () => {
    const payload = {
      slug: "my-app",
      buildStatus: "SUCCESS",
    }
    const res = await post(payload)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
  })

  it("returns 401 when signature is signed with wrong token", async () => {
    const payload = {
      slug: "my-app",
      buildStatus: "SUCCESS",
    }
    const rawBody = JSON.stringify(payload)
    const headers = createJenkinsWebhookHeaders(rawBody, "wrong-token")

    const res = await post(payload, headers)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
  })

  it("returns 401 on tampered body", async () => {
    const original = { slug: "my-app", buildStatus: "SUCCESS" }
    const rawOriginal = JSON.stringify(original)
    const headers = createJenkinsWebhookHeaders(rawOriginal, "secret-token")

    const tampered = { slug: "my-app", buildStatus: "FAILURE" }
    const res = await post(tampered, headers)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
  })

  it("returns 401 on expired timestamp (> 60 seconds ago)", async () => {
    const payload = { slug: "my-app", buildStatus: "SUCCESS" }
    const rawBody = JSON.stringify(payload)
    const expiredTs = Math.floor(Date.now() / 1000) - 65
    const headers = createJenkinsWebhookHeaders(rawBody, "secret-token", {
      timestamp: expiredTs,
    })

    const res = await post(payload, headers)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
  })

  it("handles build phase events (QUEUED, RUNNING, COMPLETED)", async () => {
    mockStackFindFirst.mockResolvedValueOnce({
      id: "stack-1",
    } as unknown as never)
    mockDeploymentFindFirst.mockResolvedValueOnce({
      id: "dep-1",
      status: "BUILDING",
    } as unknown as never)

    const payload = {
      slug: "my-app",
      buildStatus: "SUCCESS",
      phase: "RUNNING",
      buildNumber: 12,
    }
    const rawBody = JSON.stringify(payload)
    const headers = createJenkinsWebhookHeaders(rawBody, "cluster-token")

    const res = await post(payload, headers)

    expect(res.status).toBe(200)
    expect(mockRecordDeployEventOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentId: "dep-1",
        type: "JENKINS_BUILD_RUNNING",
      })
    )
  })

  it("records SUCCESS build event without prematurely marking status RUNNING", async () => {
    mockStackFindFirst.mockResolvedValueOnce({
      id: "stack-1",
    } as unknown as never)
    mockDeploymentFindFirst.mockResolvedValueOnce({
      id: "dep-1",
      status: "BUILDING",
      attempt: 1,
    } as unknown as never)

    const payload = {
      slug: "my-app",
      buildStatus: "SUCCESS",
      imageTag: "sha-123456",
    }
    const rawBody = JSON.stringify(payload)
    const headers = createJenkinsWebhookHeaders(rawBody, "cluster-token")

    const res = await post(payload, headers)

    expect(res.status).toBe(200)
    expect(mockRecordDeployEventOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentId: "dep-1",
        type: "JENKINS_BUILD_COMPLETED",
      })
    )
    expect(mockRecordDeployLog).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentId: "dep-1",
        status: "BUILD_SUCCESS",
      })
    )
  })

  it("handles FAILURE build with retry when attempt < 3", async () => {
    mockStackFindFirst.mockResolvedValueOnce({
      id: "stack-1",
    } as unknown as never)
    mockDeploymentFindFirst.mockResolvedValueOnce({
      id: "dep-1",
      status: "BUILDING",
      attempt: 1,
    } as unknown as never)

    const payload = {
      slug: "my-app",
      buildStatus: "FAILURE",
      errorMessage: "Compilation error",
    }
    const rawBody = JSON.stringify(payload)
    const headers = createJenkinsWebhookHeaders(rawBody, "cluster-token")

    const res = await post(payload, headers)

    expect(res.status).toBe(200)
    expect(mockDeploymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dep-1" },
        data: expect.objectContaining({
          status: "QUEUED",
          attempt: 2,
        }),
      })
    )
  })

  it("handles FAILURE build and marks FAILED when max retries (3) reached", async () => {
    mockStackFindFirst.mockResolvedValueOnce({
      id: "stack-1",
    } as unknown as never)
    mockDeploymentFindFirst.mockResolvedValueOnce({
      id: "dep-1",
      status: "BUILDING",
      attempt: 3,
    } as unknown as never)

    const payload = {
      slug: "my-app",
      buildStatus: "FAILURE",
      errorMessage: "Persistent failure",
    }
    const rawBody = JSON.stringify(payload)
    const headers = createJenkinsWebhookHeaders(rawBody, "cluster-token")

    const res = await post(payload, headers)

    expect(res.status).toBe(200)
    expect(mockDeploymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dep-1" },
        data: expect.objectContaining({
          status: "FAILED",
        }),
      })
    )
    expect(mockStackUpdate).toHaveBeenCalledWith({
      where: { id: "stack-1" },
      data: { lastDeployStatus: "FAILED" },
    })
  })

  it("uses env token fallback when stack is not found", async () => {
    mockStackFindFirst.mockResolvedValueOnce(null as never)

    const payload = {
      slug: "unknown-app",
      buildStatus: "SUCCESS",
    }
    const rawBody = JSON.stringify(payload)
    const headers = createJenkinsWebhookHeaders(rawBody, "secret-token")

    const res = await post(payload, headers)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: "Stack unknown-app not found",
    })
  })

  it("returns 401 when cluster integration throws and env token is unset", async () => {
    mockStackFindFirst.mockResolvedValueOnce({
      id: "stack-1",
    } as unknown as never)
    mockResolveClusterIntegration.mockRejectedValueOnce(
      new Error("Integration failure")
    )
    delete process.env.JENKINS_WEBHOOK_TOKEN

    const payload = {
      slug: "my-app",
      buildStatus: "SUCCESS",
    }
    const rawBody = JSON.stringify(payload)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(rawBody, "anything", timestamp)
    const headers = {
      "x-jenkins-timestamp": timestamp,
      "x-jenkins-signature-256": signature,
    }

    const res = await post(payload, headers)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
  })
})
