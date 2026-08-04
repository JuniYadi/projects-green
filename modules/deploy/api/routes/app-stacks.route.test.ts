import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  setSystemTime,
} from "bun:test"

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
  applicationDeployment: {
    count: mock(async () => 0),
    findMany: mock(async () => []),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { appStacksRoutes } = await import("./app-stacks.route")
const { deployRoutes } = await import("../deploy.route")

const get = (path: string) =>
  appStacksRoutes.handle(
    new Request(`http://localhost${path}`, {
      headers: { "Content-Type": "application/json" },
    })
  )

const getRecent = (path: string) =>
  deployRoutes.handle(
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
  deployments: [
    {
      id: "deploy-1",
      events: [
        { type: "QUEUED", createdAt: new Date("2026-06-05T09:00:00.000Z") },
        {
          type: "ARGOCD_SYNCED",
          createdAt: new Date("2026-06-05T09:10:00.000Z"),
        },
      ],
    },
  ],
  lastDeployedAt: new Date("2026-06-05T10:00:00.000Z"),
}

describe("appStacksRoutes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockPrisma.applicationStack.findMany.mockClear()
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationDeployment.count.mockClear()
    mockPrisma.applicationDeployment.findMany.mockClear()
    mockPrisma.applicationStack.findMany.mockResolvedValue([] as never)
    mockPrisma.applicationStack.findUnique.mockResolvedValue(null as never)
    mockPrisma.applicationDeployment.count.mockResolvedValue(0 as never)
    mockPrisma.applicationDeployment.findMany.mockResolvedValue([] as never)
  })

  afterEach(() => {
    setSystemTime()
  })

  it("returns an honest empty list when no stacks exist", async () => {
    const res = await get("/deploy/apps/")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(body.data).toEqual([])
  })

  it("returns up to three honest recent source DTOs", async () => {
    mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
      {
        sourceType: "GITHUB",
        name: "storefront",
        branchName: "main",
        rootDirectory: "/apps/web",
        repositoryConnection: {
          ownerLogin: "acme",
          githubRepositoryId: BigInt(123),
          repoName: "storefront",
        },
      },
      {
        sourceType: "PUBLIC",
        name: "",
        publicSourceUrl: "https://gitlab.com/acme/docs",
        publicSourceRef: "release",
        rootDirectory: "/",
        repositoryConnection: null,
      },
      {
        sourceType: "TEMPLATE",
        name: "Internal WordPress",
        metadataJson: { templateId: "wordpress" },
        repositoryConnection: null,
      },
      {
        sourceType: "GITHUB",
        name: "ignored-fourth-row",
        repositoryConnection: null,
      },
    ] as never)

    const res = await getRecent("/deploy/recent-sources?limit=99")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      data: [
        {
          sourceType: "github",
          label: "acme/storefront",
          ownerId: "acme",
          repositoryId: "123",
          branchName: "main",
          rootDirectory: "/apps/web",
        },
        {
          sourceType: "public",
          label: "docs",
          publicSourceUrl: "https://gitlab.com/acme/docs",
          publicSourceRef: "release",
          rootDirectory: "/",
        },
        {
          sourceType: "template",
          label: "Internal WordPress",
          templateId: "wordpress",
        },
      ],
    })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      orderBy: { updatedAt: "desc" },
      include: {
        repositoryConnection: {
          select: {
            ownerLogin: true,
            githubRepositoryId: true,
            repoName: true,
          },
        },
      },
    })
  })
  it("returns requested valid recent sources after unsupported newer rows", async () => {
    const recentStacks = [
      {
        sourceType: "UNSUPPORTED",
        name: "future-stack",
        repositoryConnection: null,
      },
      {
        sourceType: "TEMPLATE",
        name: "unsupported-template",
        metadataJson: { templateId: "not-a-template" },
        repositoryConnection: null,
      },
      {
        sourceType: "GITHUB",
        name: "storefront",
        branchName: "main",
        rootDirectory: "/apps/web",
        repositoryConnection: {
          ownerLogin: "acme",
          githubRepositoryId: BigInt(123),
          repoName: "storefront",
        },
      },
      {
        sourceType: "PUBLIC",
        name: "docs",
        publicSourceUrl: "https://gitlab.com/acme/docs",
        publicSourceRef: "release",
        rootDirectory: "/",
        repositoryConnection: null,
      },
    ]
    mockPrisma.applicationStack.findMany.mockImplementationOnce(
      (...args: unknown[]) => {
        const take = (args[0] as { take?: number } | undefined)?.take
        return Promise.resolve(
          typeof take === "number" ? recentStacks.slice(0, take) : recentStacks
        ) as never
      }
    )

    const res = await getRecent("/deploy/recent-sources?limit=2")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      data: [
        {
          sourceType: "github",
          label: "acme/storefront",
          ownerId: "acme",
          repositoryId: "123",
          branchName: "main",
          rootDirectory: "/apps/web",
        },
        {
          sourceType: "public",
          label: "docs",
          publicSourceUrl: "https://gitlab.com/acme/docs",
          publicSourceRef: "release",
          rootDirectory: "/",
        },
      ],
    })
  })

  it("omits rows that cannot reconstruct a current source", async () => {
    mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
      {
        sourceType: "GITHUB",
        name: "missing-connection",
        branchName: "main",
        rootDirectory: "/",
        repositoryConnection: null,
      },
      {
        sourceType: "PUBLIC",
        name: "missing-ref",
        publicSourceUrl: "https://github.com/acme/app",
        publicSourceRef: null,
        rootDirectory: "/",
        repositoryConnection: null,
      },
      {
        sourceType: "TEMPLATE",
        name: "unknown-template",
        metadataJson: { templateId: "not-a-template" },
        repositoryConnection: null,
      },
    ] as never)

    const res = await getRecent("/deploy/recent-sources")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, data: [] })
  })

  it("rejects unauthenticated and organization-less recent source requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const unauthenticated = await getRecent("/deploy/recent-sources")
    expect(unauthenticated.status).toBe(401)
    expect(await unauthenticated.json()).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Unauthorized",
    })

    mockWithAuth.mockResolvedValueOnce({ user: { id: "user-123" } } as never)
    const missingOrganization = await getRecent("/deploy/recent-sources")
    expect(missingOrganization.status).toBe(403)
    expect(await missingOrganization.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
      message: "Organization required",
    })
  })

  it("maps stacks into summary DTOs with current deploy step", async () => {
    mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
      sampleStack,
    ] as never)
    const res = await get("/deploy/apps/")
    const body = (await res.json()) as {
      data: Array<{
        slug: string
        status: string
        latestDeploymentId: string
        currentStepLabel: string | null
        currentStepIndex: number | null
        currentStepStartedAt: string | null
      }>
    }
    expect(body.data[0]?.slug).toBe("console-next-app")
    expect(body.data[0]?.status).toBe("running")
    expect(body.data[0]?.latestDeploymentId).toBe("deploy-1")
    expect(body.data[0]?.currentStepLabel).toBe("Synced")
    expect(body.data[0]?.currentStepIndex).toBe(10)
    expect(body.data[0]?.currentStepStartedAt).toBe("2026-06-05T09:10:00.000Z")
  })

  it("includes currentStepStartedAt from latest event createdAt in list", async () => {
    mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
      {
        ...sampleStack,
        deployments: [
          {
            id: "deploy-1",
            events: [
              {
                type: "QUEUED",
                createdAt: new Date("2026-06-05T09:00:00.000Z"),
              },
              {
                type: "DEPLOY_COMPLETED",
                createdAt: new Date("2026-06-05T09:30:00.000Z"),
              },
            ],
          },
        ],
      } as never,
    ])

    const res = await get("/deploy/apps/")
    const body = (await res.json()) as {
      data: Array<{
        slug: string
        currentStepLabel: string | null
        currentStepIndex: number | null
        currentStepStartedAt: string | null
      }>
    }
    expect(body.data[0]?.currentStepLabel).toBe("Deploy completed")
    expect(body.data[0]?.currentStepIndex).toBe(12)
    expect(body.data[0]?.currentStepStartedAt).toBe("2026-06-05T09:30:00.000Z")
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      orderBy: { updatedAt: "desc" },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
            id: true,
            events: {
              orderBy: { createdAt: "asc" },
              select: { type: true, createdAt: true },
            },
          },
        },
      },
    })
  })

  it("returns null current-step fields when latest deployment has no events", async () => {
    mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
      {
        ...sampleStack,
        deployments: [{ id: "deploy-1", events: [] }],
      },
    ] as never)

    const res = await get("/deploy/apps/")
    const body = (await res.json()) as {
      data: Array<{
        currentStepLabel: string | null
        currentStepIndex: number | null
        currentStepStartedAt: string | null
      }>
    }
    expect(body.data[0]).toMatchObject({
      currentStepLabel: null,
      currentStepIndex: null,
      currentStepStartedAt: null,
    })
  })

  it("uses latest event timestamp for detail current step", async () => {
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
          events: [
            { type: "QUEUED", createdAt: new Date("2026-06-05T09:00:00.000Z") },
            {
              type: "ARGOCD_SYNCED",
              createdAt: new Date("2026-06-05T09:10:00.000Z"),
            },
          ],
        },
      ],
    } as never)

    const res = await get("/deploy/apps/console-next-app")
    const body = (await res.json()) as {
      data: { stack: { currentStepStartedAt: string | null } }
    }
    expect(body.data.stack.currentStepStartedAt).toBe(
      "2026-06-05T09:10:00.000Z"
    )
  })

  it("calculates active duration with a fixed current time", async () => {
    setSystemTime(new Date("2026-06-05T10:00:10.000Z"))
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
      id: "stack-1",
    } as never)
    mockPrisma.applicationDeployment.count.mockResolvedValueOnce(1 as never)
    mockPrisma.applicationDeployment.findMany.mockResolvedValueOnce([
      {
        id: "deploy-3",
        status: "BUILDING",
        attempt: 3,
        commitSha: "def456",
        failureReason: null,
        startedAt: new Date("2026-06-05T10:00:00.000Z"),
        completedAt: null,
      },
    ] as never)

    const res = await get(
      "/deploy/apps/console-next-app/history?page=1&pageSize=20"
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: Array<{ durationMs: number | null }>
    }
    expect(body.data[0]?.durationMs).toBe(10_000)
  })

  it("returns stack overview with latest deployment status and current step", async () => {
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
          events: [
            { type: "QUEUED", createdAt: new Date("2026-06-05T09:00:00.000Z") },
            {
              type: "ARGOCD_SYNCED",
              createdAt: new Date("2026-06-05T09:10:00.000Z"),
            },
          ],
        },
      ],
    } as never)

    const res = await get("/deploy/apps/console-next-app")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: {
        stack: {
          slug: string
          currentStepLabel: string | null
          currentStepIndex: number | null
          currentStepStartedAt: string | null
        }
        latestDeployment: { status: string } | null
      }
    }
    expect(body.data.stack.slug).toBe("console-next-app")
    expect(body.data.stack.currentStepLabel).toBe("Synced")
    expect(body.data.stack.currentStepIndex).toBe(10)
    expect(body.data.stack.currentStepStartedAt).toBe(
      "2026-06-05T09:10:00.000Z"
    )
    expect(body.data.latestDeployment?.status).toBe("running")
  })

  it("includes currentStepStartedAt from detail event createdAt", async () => {
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
          events: [
            { type: "QUEUED", createdAt: new Date("2026-06-05T09:00:00.000Z") },
            {
              type: "DEPLOY_COMPLETED",
              createdAt: new Date("2026-06-05T09:30:00.000Z"),
            },
          ],
        },
      ],
    } as never)

    const res = await get("/deploy/apps/console-next-app")
    const body = (await res.json()) as {
      data: {
        stack: {
          slug: string
          currentStepLabel: string | null
          currentStepIndex: number | null
          currentStepStartedAt: string | null
        }
        latestDeployment: { status: string } | null
      }
    }
    expect(body.data.stack.currentStepLabel).toBe("Deploy completed")
    expect(body.data.stack.currentStepIndex).toBe(12)
    expect(body.data.stack.currentStepStartedAt).toBe(
      "2026-06-05T09:30:00.000Z"
    )
  })

  it("returns paginated deployment history with bounded page size", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
      id: "stack-1",
    } as never)
    mockPrisma.applicationDeployment.count.mockResolvedValueOnce(3 as never)
    mockPrisma.applicationDeployment.findMany.mockResolvedValueOnce([
      {
        id: "deploy-2",
        status: "FAILED",
        attempt: 2,
        commitSha: "abc123",
        failureReason: "build failed",
        startedAt: new Date("2026-06-05T10:00:00.000Z"),
        completedAt: new Date("2026-06-05T10:00:05.000Z"),
      },
    ] as never)

    const res = await get(
      "/deploy/apps/console-next-app/history?page=2&pageSize=999"
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: Array<{
        id: string
        status: string
        attempt: number
        durationMs: number | null
        commitSha: string | null
        failureReason: string | null
        startedAt: string | null
        completedAt: string | null
      }>
      meta: {
        page: number
        pageSize: number
        total: number
        totalPages: number
      }
    }
    expect(body).toEqual({
      ok: true,
      data: [
        {
          id: "deploy-2",
          status: "failed",
          attempt: 2,
          durationMs: 5000,
          commitSha: "abc123",
          failureReason: "build failed",
          startedAt: "2026-06-05T10:00:00.000Z",
          completedAt: "2026-06-05T10:00:05.000Z",
        },
      ],
      meta: { page: 2, pageSize: 100, total: 3, totalPages: 1 },
    })
    expect(mockPrisma.applicationStack.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_slug: {
          organizationId: "org-1",
          slug: "console-next-app",
        },
      },
      select: { id: true },
    })
    expect(mockPrisma.applicationDeployment.count).toHaveBeenCalledWith({
      where: { stackId: "stack-1" },
    })
    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith({
      where: { stackId: "stack-1" },
      orderBy: { createdAt: "desc" },
      skip: 100,
      take: 100,
    })
  })

  it("returns 404 for history on an unknown stack", async () => {
    const res = await get("/deploy/apps/missing/history")
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
      message: "Application not found",
    })
  })

  it("rejects unauthenticated history requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const res = await get("/deploy/apps/console-next-app/history")
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Unauthorized",
    })
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
