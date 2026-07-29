import { beforeEach, describe, expect, it, mock } from "bun:test"

const withAuth = mock(async () => ({
  user: { id: "user-123", email: "u@example.com" },
  organizationId: "org-1",
  role: "admin",
  roles: ["admin"],
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth,
}))

const mockPrisma = {
  applicationDeployment: {
    findUnique: mock(async () => ({
      id: "deploy-1",
      organizationId: "org-1",
    })),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const getPodsMock = mock(async () => [
  {
    name: "pod-a",
    phase: "Running",
    readyContainers: 1,
    totalContainers: 2,
    restartCount: 3,
    latestWarningEvent: null,
  },
])
mock.module("../../pod-status.service", () => ({
  getDeploymentPods: getPodsMock,
}))

const { podStatusRoutes } = await import("./pod-status.route")

const get = (deployId: string) =>
  podStatusRoutes.handle(
    new Request(`http://localhost/deploy/pods/${deployId}`, { method: "GET" })
  )

describe("GET /deploy/pods/:deployId", () => {
  beforeEach(() => {
    withAuth.mockClear()
    mockPrisma.applicationDeployment.findUnique.mockClear()
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      organizationId: "org-1",
    })
    getPodsMock.mockClear()
    getPodsMock.mockResolvedValue([
      {
        name: "pod-a",
        phase: "Running",
        readyContainers: 1,
        totalContainers: 2,
        restartCount: 3,
        latestWarningEvent: null,
      },
    ])
  })

  it("returns pod DTO list for authenticated user", async () => {
    const res = await get("deploy-1")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: Array<{ name: string }>
    }
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.name).toBe("pod-a")
  })

  it("returns 401 when unauthenticated", async () => {
    withAuth.mockResolvedValueOnce({ user: null } as never)
    const res = await get("deploy-1")
    expect(res.status).toBe(401)
  })

  it("returns 404 when deployment is missing", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(
      null as never
    )
    const res = await get("deploy-1")
    expect(res.status).toBe(404)
  })

  it("returns 403 when deployment belongs to a different organization", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
      id: "deploy-1",
      organizationId: "org-other",
    } as never)
    const res = await get("deploy-1")
    expect(res.status).toBe(403)
  })
})
