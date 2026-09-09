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
    update: mock(async () => null),
  },
  applicationDeployment: {
    count: mock(async () => 0),
    findMany: mock(async () => []),
  },
  billingAccount: {
    findUnique: mock(async () => null),
  },
  servicePlan: {
    findFirst: mock(async () => null),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
const mockQueryAppLogs = mock(async () => ({
  hits: [
    {
      id: "log-1",
      timestamp: "12:00:00",
      level: "INFO",
      source: "deploy",
      message: "Hello world",
    },
  ],
  total: 1,
  took: 5,
}))

mock.module("../../opensearch/opensearch-query.service", () => ({
  queryAppLogs: mockQueryAppLogs,
}))

const {
  appStacksRoutes,
  validateResourceBounds,
  MAX_CPU,
  MAX_MEMORY,
  MAX_ALLOWED_REPLICAS,
} = await import("./app-stacks.route")
const { deployRoutes } = await import("../deploy.route")

const get = (path: string) =>
  appStacksRoutes.handle(
    new Request(`http://localhost${path}`, {
      headers: { "Content-Type": "application/json" },
    })
  )

const patch = (path: string, body: unknown) =>
  appStacksRoutes.handle(
    new Request(`http://localhost${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const post = (path: string, body?: unknown) =>
  appStacksRoutes.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
    mockPrisma.applicationStack.update.mockClear()
    mockPrisma.applicationDeployment.count.mockClear()
    mockPrisma.applicationDeployment.findMany.mockClear()
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.servicePlan.findFirst.mockClear()
    mockPrisma.applicationStack.findMany.mockResolvedValue([] as never)
    mockPrisma.applicationStack.findUnique.mockResolvedValue(null as never)
    mockPrisma.applicationStack.update.mockResolvedValue(null as never)
    mockPrisma.applicationDeployment.count.mockResolvedValue(0 as never)
    mockPrisma.applicationDeployment.findMany.mockResolvedValue([] as never)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null as never)
    mockPrisma.servicePlan.findFirst.mockResolvedValue(null as never)
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
    expect(body.data[0]?.currentStepLabel).toBe("Deployment verified")
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
    expect(body.data[0]?.currentStepLabel).toBe("Application live")
    expect(body.data[0]?.currentStepIndex).toBe(12)
    expect(body.data[0]?.currentStepStartedAt).toBe("2026-06-05T09:30:00.000Z")
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      orderBy: { updatedAt: "desc" },
      include: {
        template: true,
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
    expect(body.data.stack.currentStepLabel).toBe("Deployment verified")
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
    expect(body.data.stack.currentStepLabel).toBe("Application live")
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

  describe("scaling quota bounds and validation", () => {
    it("validates within bounds correctly", () => {
      const result = validateResourceBounds({
        replicas: 2,
        cpu: 1000,
        memory: 1024,
      })
      expect(result.valid).toBe(true)
    })

    it("rejects replicas exceeding MAX_ALLOWED_REPLICAS", () => {
      const result = validateResourceBounds({
        replicas: 9,
        cpu: 100,
        memory: 100,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe("REPLICAS_EXCEEDED")
    })

    it("rejects total CPU exceeding MAX_CPU", () => {
      const result = validateResourceBounds({
        replicas: 5,
        cpu: 1000,
        memory: 512,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe("CPU_QUOTA_EXCEEDED")
    })

    it("rejects total memory exceeding MAX_MEMORY", () => {
      const result = validateResourceBounds({
        replicas: 5,
        cpu: 500,
        memory: 1024,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe("MEMORY_QUOTA_EXCEEDED")
    })

    it("rejects scaling PATCH when unauthenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null } as never)
      const res = await patch("/deploy/apps/console-next-app/scaling", {
        replicas: 2,
      })
      expect(res.status).toBe(401)
    })

    it("rejects scaling PATCH when stack not found", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(
        null as never
      )
      const res = await patch("/deploy/apps/missing/scaling", {
        replicas: 2,
      })
      expect(res.status).toBe(404)
    })

    it("returns 422 when scaling request exceeds CPU quota", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        cpu: 2000,
        memory: 512,
        metadataJson: null,
      } as never)

      const res = await patch("/deploy/apps/console-next-app/scaling", {
        replicas: 3,
      })
      expect(res.status).toBe(422)
      const body = (await res.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CPU_QUOTA_EXCEEDED")
    })

    it("returns 422 when scaling request exceeds Memory quota", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        cpu: 500,
        memory: 2048,
        metadataJson: null,
      } as never)

      const res = await patch("/deploy/apps/console-next-app/scaling", {
        replicas: 3,
      })
      expect(res.status).toBe(422)
      const body = (await res.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("MEMORY_QUOTA_EXCEEDED")
    })

    it("updates stack and returns 200 when scaling request is within bounds", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        cpu: 1000,
        memory: 512,
        metadataJson: { replicas: 1 },
      } as never)
      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      } as never)

      const res = await patch("/deploy/apps/console-next-app/scaling", {
        replicas: 3,
        cpu: 1000,
        memory: 512,
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        ok: boolean
        data: {
          replicas: number
          cpu: number
          memory: number
          totalCpu: number
          totalMemory: number
        }
      }
      expect(body.ok).toBe(true)
      expect(body.data).toEqual({
        replicas: 3,
        cpu: 1000,
        memory: 512,
        totalCpu: 3000,
        totalMemory: 1536,
      })
      expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith({
        where: { id: "stack-1" },
        data: {
          cpu: 1000,
          memory: 512,
          metadataJson: {
            replicas: 3,
          },
        },
      })
    })
  })

  describe("POST /deploy/apps/:slug/cancel", () => {
    it("returns 401 when unauthenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({
        user: null,
        organizationId: null,
      } as never)

      const res = await post("/deploy/apps/console-next-app/cancel")
      expect(res.status).toBe(401)
      const body = (await res.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when organization is missing", async () => {
      mockWithAuth.mockResolvedValueOnce({
        user: { id: "user-123" },
        organizationId: null,
      } as never)

      const res = await post("/deploy/apps/console-next-app/cancel")
      expect(res.status).toBe(403)
      const body = (await res.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when application stack does not exist", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(
        null as never
      )
      const res = await post("/deploy/apps/unknown-app/cancel")
      expect(res.status).toBe(404)
      const body = (await res.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("schedules cancellation and returns 200 with activeUntil", async () => {
      const createdAt = new Date("2026-09-01T00:00:00.000Z")
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        ...sampleStack,
        createdAt,
        metadataJson: { customKey: "value" },
      } as never)
      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        ...sampleStack,
        createdAt,
      } as never)

      const res = await post("/deploy/apps/console-next-app/cancel")
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        ok: boolean
        message: string
        activeUntil: string
      }
      expect(body.ok).toBe(true)
      expect(body.message).toBe("Service cancellation scheduled")
      expect(body.activeUntil).toBe("2026-10-01T00:00:00.000Z")

      expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith({
        where: { id: sampleStack.id },
        data: {
          metadataJson: expect.objectContaining({
            customKey: "value",
            cancellationScheduled: true,
            cancelledAt: expect.any(String),
          }),
        },
      })
    })
  })

  describe("POST /deploy/apps/:slug/sync", () => {
    it("updates updatedAt timestamp and returns 200", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "console-next-app",
        organizationId: "org-1",
      } as never)
      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      } as never)

      const res = await post("/deploy/apps/console-next-app/sync")
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean; message: string }
      expect(body.ok).toBe(true)
      expect(body.message).toBe("Configuration synced successfully")
      expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith({
        where: { id: "stack-1" },
        data: { updatedAt: expect.any(Date) },
      })
    })

    it("returns 404 when stack is not found", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)
      const res = await post("/deploy/apps/nonexistent/sync")
      expect(res.status).toBe(404)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null } as never)
      const res = await post("/deploy/apps/console-next-app/sync")
      expect(res.status).toBe(401)
    })

    it("returns 403 when user has no organizationId", async () => {
      mockWithAuth.mockResolvedValueOnce({
        user: { id: "user-1" },
        organizationId: null,
      } as never)
      const res = await post("/deploy/apps/console-next-app/sync")
      expect(res.status).toBe(403)
    })
  })

  describe("GET /deploy/apps/:slug/logs", () => {
    it("returns logs for an application stack", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
      } as never)

      const res = await get(
        "/deploy/apps/console-next-app/logs?limit=50&level=INFO"
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        ok: boolean
        data: Array<{ message: string; source: string; level: string }>
        total: number
        took: number
      }
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].message).toBe("Hello world")
      expect(body.total).toBe(1)
      expect(mockQueryAppLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "console-next-app",
          limit: 50,
          level: "INFO",
        })
      )
    })

    it("returns 404 when application stack does not exist", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)
      const res = await get("/deploy/apps/nonexistent/logs")
      expect(res.status).toBe(404)
    })

    it("returns 401 when unauthenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null } as never)
      const res = await get("/deploy/apps/console-next-app/logs")
      expect(res.status).toBe(401)
    })

    it("returns 403 when user has no organizationId", async () => {
      mockWithAuth.mockResolvedValueOnce({
        user: { id: "u-1" },
        organizationId: null,
      } as never)
      const res = await get("/deploy/apps/console-next-app/logs")
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({
        ok: false,
        error: "FORBIDDEN",
        message: "Organization required",
      })
    })

    it("passes search, source, time range, and asc order to queryAppLogs", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
      } as never)

      const res = await get(
        "/deploy/apps/console-next-app/logs?q=fatal&source=nginx&order=asc&from=2026-09-01&to=2026-09-08"
      )
      expect(res.status).toBe(200)
      expect(mockQueryAppLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "console-next-app",
          q: "fatal",
          source: "nginx",
          order: "asc",
          from: "2026-09-01",
          to: "2026-09-08",
          limit: 100,
        })
      )
    })
  })
})
