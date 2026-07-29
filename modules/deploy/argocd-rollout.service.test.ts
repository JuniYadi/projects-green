import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationDeployment: {
    findUnique: mock(async () => ({
      id: "deploy-1",
      stackId: "stack-1",
      status: "DEPLOYING",
      argocdSynced: false,
      stack: { id: "stack-1", slug: "app-test" },
    })),
    update: mock(async () => ({})),
  },
  applicationStack: {
    update: mock(async () => ({})),
  },
  applicationDeployEvent: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "event-1" })),
  },
}

const recordEvent = mock(async (..._args: unknown[]) => undefined)

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("./deploy-event.service", () => ({
  recordDeployEvent: recordEvent,
  recordDeployLog: mock(async () => undefined),
}))
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mock(async (_id: string, type: string) => {
    if (type === "ARGOCD") {
      return {
        apiUrl: "https://argocd.example.com",
        token: "argo-token",
        project: "default",
        appNamespace: "argocd",
        webhookSecret: null,
        chartRepo: null,
        chartVersion: null,
      }
    }
    throw new Error("missing " + type)
  }),
}))

const originalFetch = globalThis.fetch

const setupFetch = (response: {
  ok: boolean
  status?: number
  body?: unknown
}) => {
  const fetchMock = mock(async (..._args: unknown[]) => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    statusText: response.ok ? "OK" : "Error",
    json: async () => response.body ?? {},
  }))
  globalThis.fetch = fetchMock as any as typeof fetch
}

const restoreFetch = () => {
  globalThis.fetch = originalFetch
}

const { pollDeploymentRollout, getArgoCdApplicationStatus } =
  await import("./argocd-rollout.service")

describe("argocd-rollout.service", () => {
  beforeEach(() => {
    mockPrisma.applicationDeployment.findUnique.mockReset()
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-1",
      status: "DEPLOYING",
      argocdSynced: false,
      stack: { id: "stack-1", slug: "app-test" },
    })
    mockPrisma.applicationDeployment.update.mockReset()
    mockPrisma.applicationDeployment.update.mockResolvedValue({})
    mockPrisma.applicationStack.update.mockReset()
    mockPrisma.applicationStack.update.mockResolvedValue({})
    mockPrisma.applicationDeployEvent.findFirst.mockReset()
    mockPrisma.applicationDeployEvent.findFirst.mockResolvedValue(null)
    recordEvent.mockReset()
    recordEvent.mockResolvedValue(undefined)
  })

  it("returns Synced + Healthy completion with POD_READY + DEPLOY_COMPLETED", async () => {
    setupFetch({
      ok: true,
      body: {
        status: {
          sync: { status: "Synced" },
          health: { status: "Healthy" },
        },
      },
    })
    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(true)
    expect(result.status).toEqual({
      syncStatus: "Synced",
      healthStatus: "Healthy",
    })
    const types = recordEvent.mock.calls.map((c) => {
      const arg = c[0] as { data?: { type?: string }; type?: string }
      return arg.data?.type ?? arg.type ?? ""
    })
    expect(types).toContain("ARGOCD_SYNCED")
    expect(types).toContain("POD_READY")
    expect(types).toContain("DEPLOY_COMPLETED")
    restoreFetch()
  })

  it("returns Progressing without completion", async () => {
    setupFetch({
      ok: true,
      body: {
        status: {
          sync: { status: "Synced" },
          health: { status: "Progressing" },
        },
      },
    })
    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(false)
    expect(result.status?.healthStatus).toBe("Progressing")
    const types = recordEvent.mock.calls.map(
      (c) =>
        (c[0] as any as { data?: { type?: string } }).data?.type ??
        (c[0] as any as { type?: string }).type
    )
    expect(types).not.toContain("DEPLOY_COMPLETED")
    expect(types).not.toContain("POD_READY")
    restoreFetch()
  })

  it("marks deployment FAILED on Degraded health", async () => {
    setupFetch({
      ok: true,
      body: {
        status: {
          sync: { status: "Synced" },
          health: { status: "Degraded" },
        },
      },
    })
    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(true)
    const types = recordEvent.mock.calls.map(
      (c) =>
        (c[0] as any as { data?: { type?: string } }).data?.type ??
        (c[0] as any as { type?: string }).type
    )
    expect(types).toContain("DEPLOY_FAILED")
    restoreFetch()
  })

  it("returns no completion when ArgoCD app returns 404", async () => {
    setupFetch({ ok: false, status: 404, body: {} })
    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(false)
    expect(result.status).toBeNull()
    restoreFetch()
  })

  it("returns no completion when deployment is missing", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(
      null as any
    )
    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(false)
    expect(result.status).toBeNull()
  })

  it("getArgoCdApplicationStatus parses sync and health", async () => {
    setupFetch({
      ok: true,
      body: {
        status: {
          sync: { status: "Synced" },
          health: { status: "Healthy" },
        },
      },
    })
    const status = await getArgoCdApplicationStatus(
      {
        apiUrl: "https://argocd.example.com",
        token: "argo-token",
        project: "default",
        appNamespace: "argocd",
        webhookSecret: null,
        chartRepo: null,
        chartVersion: null,
      },
      "app-test"
    )
    expect(status.syncStatus).toBe("Synced")
    expect(status.healthStatus).toBe("Healthy")
    restoreFetch()
  })
})
