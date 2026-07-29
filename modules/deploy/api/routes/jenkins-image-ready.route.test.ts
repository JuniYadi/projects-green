import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockHandle = mock(async (_input: Record<string, unknown>) => ({
  ok: true as const,
  deploymentId: "deploy-1",
  gitopsCommitSha: "gitops-sha-1",
  idempotent: false,
}))

mock.module("../../jenkins-image-ready.service", () => ({
  handleJenkinsImageReady: mockHandle,
}))

const resolveCluster = mock(async (_stackId: string, type: string) => {
  if (type === "JENKINS") {
    return { webhookToken: "expected-token" }
  }
  throw new Error("missing " + type)
})
mock.module("../../cluster-integration.service", () => ({
  resolveClusterIntegration: resolveCluster,
}))

const stackRecord = { id: "stack-1", slug: "app-metacard-prod" }
const mockPrisma = {
  applicationStack: {
    findUnique: mock(async () => stackRecord),
    findFirst: mock(async () => stackRecord),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { deployJenkinsImageReadyRoutes } =
  await import("./jenkins-image-ready.route")

const post = (body: Record<string, unknown>) =>
  deployJenkinsImageReadyRoutes.handle(
    new Request("http://localhost/deploy/jenkins-image-ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

describe("POST /deploy/jenkins-image-ready", () => {
  beforeEach(() => {
    mockHandle.mockClear()
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.findFirst.mockReset()
    mockPrisma.applicationStack.findUnique.mockResolvedValue(stackRecord)
    mockPrisma.applicationStack.findFirst.mockResolvedValue(stackRecord)
    mockHandle.mockResolvedValue({
      ok: true as const,
      deploymentId: "deploy-1",
      gitopsCommitSha: "gitops-sha-1",
      idempotent: false,
    })
  })

  it("returns 401 when token does not match", async () => {
    const res = await post({
      slug: "app-metacard-prod",
      imageTag: "187",
      token: "wrong",
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mockHandle).not.toHaveBeenCalled()
  })

  it("returns 200 with handler result when token matches", async () => {
    const res = await post({
      slug: "app-metacard-prod",
      imageTag: "187",
      deploymentId: "deploy-1",
      commitSha: "abc123",
      buildNumber: 42,
      token: "expected-token",
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; deploymentId: string }
    expect(body.ok).toBe(true)
    expect(body.deploymentId).toBe("deploy-1")
    expect(mockHandle).toHaveBeenCalledTimes(1)
    const calledWith = mockHandle.mock.calls[0]?.[0] as Record<string, unknown>
    expect(calledWith).toBeDefined()
    expect(calledWith?.slug).toBe("app-metacard-prod")
    expect(calledWith?.imageTag).toBe("187")
    expect(calledWith?.deploymentId).toBe("deploy-1")
  })

  it("accepts request without optional deploymentId", async () => {
    const res = await post({
      slug: "app-metacard-prod",
      imageTag: "187",
      token: "expected-token",
    })
    expect(res.status).toBe(200)
    const calledWith = mockHandle.mock.calls[0]?.[0] as Record<string, unknown>
    expect(calledWith?.deploymentId).toBeUndefined()
  })

  it("uses env token fallback when stack is not found", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null as never)
    process.env.JENKINS_WEBHOOK_TOKEN = "env-token"
    const res = await post({
      slug: "missing",
      imageTag: "187",
      token: "env-token",
    })
    expect(res.status).toBe(200)
    expect(mockHandle).toHaveBeenCalledTimes(1)
    delete process.env.JENKINS_WEBHOOK_TOKEN
  })

  it("returns 401 when cluster integration throws and env token is unset", async () => {
    resolveCluster.mockRejectedValueOnce(new Error("No integration configured"))
    delete process.env.JENKINS_WEBHOOK_TOKEN
    const res = await post({
      slug: "app-metacard-prod",
      imageTag: "187",
      token: "anything",
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mockHandle).not.toHaveBeenCalled()
  })
})
