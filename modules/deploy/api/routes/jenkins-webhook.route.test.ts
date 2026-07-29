import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockRecordDeployEvent = mock(
  async (_params: Record<string, unknown>) => ({ id: "event-1" })
)
const mockRecordDeployLog = mock(async (_params: Record<string, unknown>) => ({
  id: "log-1",
}))

mock.module("../../deploy-event.service", () => ({
  recordDeployEvent: mockRecordDeployEvent,
  recordDeployEventOnce: mockRecordDeployEvent,
  recordDeployLog: mockRecordDeployLog,
}))

const mockPrisma = {
  applicationStack: {
    findFirst: mock(async () => null),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { deployJenkinsWebhookRoutes } = await import("./jenkins-webhook.route")

const post = (body: Record<string, unknown>) =>
  deployJenkinsWebhookRoutes.handle(
    new Request("http://localhost/deploy/jenkins-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

describe("POST /deploy/jenkins-webhook", () => {
  beforeEach(() => {
    mockRecordDeployEvent.mockClear()
    mockRecordDeployLog.mockClear()
    mockPrisma.applicationStack.findFirst.mockClear()
    delete process.env.JENKINS_WEBHOOK_TOKEN
  })

  it("returns 401 when JENKINS_WEBHOOK_TOKEN is not set", async () => {
    const res = await post({
      slug: "app-metacard-prod",
      buildStatus: "SUCCESS",
      token: "anything",
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mockRecordDeployEvent).not.toHaveBeenCalled()
  })

  it("returns 401 when token does not match", async () => {
    process.env.JENKINS_WEBHOOK_TOKEN = "secret-token"
    const res = await post({
      slug: "app-metacard-prod",
      buildStatus: "SUCCESS",
      token: "wrong-token",
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mockRecordDeployEvent).not.toHaveBeenCalled()
  })
})
