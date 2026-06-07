import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWithAuth = mock(async () => ({
  user: { id: "user-123", email: "test@example.com" },
  organizationId: "org-1",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockPrisma = {
  applicationStack: {
    findMany: mock(async () => []),
    findUnique: mock(async () => null),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { appStacksRoutes } = await import("./app-stacks.route")

const get = (path: string) =>
  appStacksRoutes.handle(
    new Request(`http://localhost${path}`, {
      headers: { "Content-Type": "application/json" },
    })
  )

const sampleStack = {
  id: "stack-1",
  name: "console-next-app",
  slug: "console-next-app",
  status: "RUNNING",
  framework: "Next.js",
  branchName: "main",
  subdomain: "console-next-app.pfn.app",
  customDomain: null,
  resourcePlanId: "payg",
  billingMode: "PAYG",
  metadataJson: null,
  lastDeployedAt: new Date("2026-06-05T10:00:00.000Z"),
  deployments: [{ id: "deploy-1" }],
}

describe("appStacksRoutes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockPrisma.applicationStack.findMany.mockClear()
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.findMany.mockResolvedValue([] as never)
    mockPrisma.applicationStack.findUnique.mockResolvedValue(null as never)
  })

  it("returns an honest empty list when no stacks exist", async () => {
    const res = await get("/deploy/apps/")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(body.data).toEqual([])
  })

  it("maps stacks into summary DTOs", async () => {
    mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
      sampleStack,
    ] as never)
    const res = await get("/deploy/apps/")
    const body = (await res.json()) as {
      data: Array<{ slug: string; status: string; latestDeploymentId: string }>
    }
    expect(body.data[0]?.slug).toBe("console-next-app")
    expect(body.data[0]?.status).toBe("running")
    expect(body.data[0]?.latestDeploymentId).toBe("deploy-1")
  })

  it("returns stack overview with latest deployment status", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
      ...sampleStack,
      deployments: [
        {
          id: "deploy-1",
          status: "RUNNING",
          attempt: 1,
          manifestPushed: true,
          argocdSynced: true,
          failureReason: null,
          startedAt: null,
          completedAt: null,
        },
      ],
    } as never)

    const res = await get("/deploy/apps/console-next-app")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: {
        stack: { slug: string }
        latestDeployment: { status: string } | null
      }
    }
    expect(body.data.stack.slug).toBe("console-next-app")
    expect(body.data.latestDeployment?.status).toBe("running")
  })

  it("returns 404 for an unknown stack", async () => {
    const res = await get("/deploy/apps/missing")
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("NOT_FOUND")
  })

  it("rejects unauthenticated requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const res = await get("/deploy/apps/")
    expect(res.status).toBe(401)
  })
})
