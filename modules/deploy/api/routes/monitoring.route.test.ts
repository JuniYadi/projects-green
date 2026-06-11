import { describe, expect, it, mock, beforeEach } from "bun:test"

const mockWithAuth = mock(async () => ({
  user: {
    id: "user-123",
    email: "test@example.com",
  },
  organizationId: "org-1",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockPrisma = {
  applicationDeployment: {
    findUnique: mock(async () => ({
      id: "deploy-123",
      organizationId: "org-1",
      status: "RUNNING",
      attempt: 1,
      manifestPushed: true,
      argocdSynced: true,
      failureReason: null,
      startedAt: new Date("2026-06-05T10:00:00.000Z"),
      completedAt: new Date("2026-06-05T10:05:00.000Z"),
    })),
  },
  applicationDeploymentLog: {
    findMany: mock(async () => []),
  },
  applicationDeployEvent: {
    findMany: mock(async () => []),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { monitoringRoutes } = await import("./monitoring.route")

const buildRequest = (path: string) =>
  new Request(`http://localhost${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  })

const setDeployment = (value: unknown) => {
  mockPrisma.applicationDeployment.findUnique.mockResolvedValue(value as never)
}

describe("monitoringRoutes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockPrisma.applicationDeployment.findUnique.mockClear()
    mockPrisma.applicationDeploymentLog.findMany.mockClear()
    mockPrisma.applicationDeployEvent.findMany.mockClear()

    setDeployment({
      id: "deploy-123",
      organizationId: "org-1",
      status: "RUNNING",
      attempt: 1,
      manifestPushed: true,
      argocdSynced: true,
      failureReason: null,
      startedAt: new Date("2026-06-05T10:00:00.000Z"),
      completedAt: new Date("2026-06-05T10:05:00.000Z"),
    })
    mockPrisma.applicationDeploymentLog.findMany.mockResolvedValue([] as never)
    mockPrisma.applicationDeployEvent.findMany.mockResolvedValue([] as never)
  })

  it("returns real logs for a deployment (empty no-data state)", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/logs/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(body.data).toEqual([])
  })

  it("maps persisted logs into log lines", async () => {
    mockPrisma.applicationDeploymentLog.findMany.mockResolvedValueOnce([
      { id: "l1", scope: "build", status: "BUILDING", message: "compiling" },
    ] as never)

    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/logs/deploy-123")
    )

    const body = (await response.json()) as {
      data: Array<{ id: string; scope: string; status: string }>
    }
    expect(body.data[0]).toEqual({
      id: "l1",
      scope: "build",
      status: "building",
      message: "compiling",
    } as never)
  })

  it("returns canonical timeline + real event stream", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/events/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      ok: boolean
      data: Array<{ id: string }>
      events: unknown[]
    }
    expect(body.ok).toBe(true)
    expect(body.data.map((item) => item.id)).toEqual(["prep", "build", "deploy"])
    expect(Array.isArray(body.events)).toBe(true)
  })

  it("returns real status for a deployment", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/status/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      ok: boolean
      data: { status: string; attempt: number }
    }
    expect(body.ok).toBe(true)
    expect(body.data.status).toBe("running")
    expect(body.data.attempt).toBe(1)
  })

  it("returns 404 when the deployment does not exist", async () => {
    setDeployment(null)

    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/status/missing")
    )

    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 403 when the deployment belongs to another org", async () => {
    setDeployment({
      id: "deploy-123",
      organizationId: "org-other",
      status: "RUNNING",
      attempt: 1,
      manifestPushed: true,
      argocdSynced: true,
      failureReason: null,
      startedAt: null,
      completedAt: null,
    })

    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/status/deploy-123")
    )

    expect(response.status).toBe(403)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("FORBIDDEN")
  })

  it("rejects unauthenticated requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)

    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/logs/deploy-123")
    )

    expect(response.status).toBe(401)
  })
})
