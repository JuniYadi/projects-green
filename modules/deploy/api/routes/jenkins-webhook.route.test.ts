import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

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

import { deployJenkinsWebhookRoutes } from "./jenkins-webhook.route"

describe("deploy jenkins-webhook.route", () => {
  let app: Elysia
  const originalToken = process.env.JENKINS_WEBHOOK_TOKEN

  beforeEach(() => {
    process.env.JENKINS_WEBHOOK_TOKEN = "secret-token"
    mockStackFindFirst.mockClear()
    mockDeploymentFindFirst.mockClear()
    mockDeploymentUpdate.mockClear()
    mockStackUpdate.mockClear()
    mockRecordDeployEventOnce.mockClear()
    mockRecordDeployLog.mockClear()
    app = new Elysia().use(deployJenkinsWebhookRoutes)
  })

  it("returns 401 on missing or invalid webhook token", async () => {
    const res = await app.handle(
      new Request("http://localhost/deploy/jenkins-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "wrong-token",
          slug: "my-app",
          buildStatus: "SUCCESS",
        }),
      })
    )

    expect(res.status).toBe(401)
  })

  it("handles build phase events (QUEUED, RUNNING, COMPLETED)", async () => {
    mockStackFindFirst.mockResolvedValueOnce({
      id: "stack-1",
    } as unknown as never)
    mockDeploymentFindFirst.mockResolvedValueOnce({
      id: "dep-1",
      status: "BUILDING",
    } as unknown as never)

    const res = await app.handle(
      new Request("http://localhost/deploy/jenkins-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "secret-token",
          slug: "my-app",
          buildStatus: "SUCCESS",
          phase: "RUNNING",
          buildNumber: 12,
        }),
      })
    )

    expect(res.status).toBe(200)
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

    const res = await app.handle(
      new Request("http://localhost/deploy/jenkins-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "secret-token",
          slug: "my-app",
          buildStatus: "SUCCESS",
          imageTag: "sha-123456",
        }),
      })
    )

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

    const res = await app.handle(
      new Request("http://localhost/deploy/jenkins-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "secret-token",
          slug: "my-app",
          buildStatus: "FAILURE",
          errorMessage: "Compilation error",
        }),
      })
    )

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

    const res = await app.handle(
      new Request("http://localhost/deploy/jenkins-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "secret-token",
          slug: "my-app",
          buildStatus: "FAILURE",
          errorMessage: "Persistent failure",
        }),
      })
    )

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
})
