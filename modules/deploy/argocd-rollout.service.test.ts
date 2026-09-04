import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  $transaction: mock(async (fn: (tx: unknown) => unknown) => fn(mockTx)),
  applicationDeployment: {
    findUnique: mock(async () => ({
      id: "deploy-1",
      stackId: "stack-1",
      status: "DEPLOYING",
      argocdSynced: false,
      completedAt: null,
      startedAt: new Date(),
      createdAt: new Date(),
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

const mockTx = {
  applicationDeployment: {
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
  recordDeployEventOnce: recordEvent,
  recordDeployLog: mock(async () => undefined),
}))
let resolveClusterIntegrationMock = async (_id: string, type: string) => {
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
}
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mock((id: string, type: string) =>
    resolveClusterIntegrationMock(id, type)
  ),
}))

let ingressReadinessImpl: (
  deploymentId: string
) => Promise<boolean> = async () => true
const checkIngressReadinessMock = mock((deploymentId: string) =>
  ingressReadinessImpl(deploymentId)
)
mock.module("./ingress-readiness.service", () => ({
  checkIngressReadiness: checkIngressReadinessMock,
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
      completedAt: null,
      startedAt: new Date(),
      createdAt: new Date(),
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
    checkIngressReadinessMock.mockReset()
    ingressReadinessImpl = async () => true
    checkIngressReadinessMock.mockImplementation((deploymentId: string) =>
      ingressReadinessImpl(deploymentId)
    )
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

  it("still sets RUNNING when the ingress readiness check fails", async () => {
    ingressReadinessImpl = async () => false
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
    expect(mockPrisma.applicationDeployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "deploy-1" },
        data: expect.objectContaining({ ingressVerified: false }),
      })
    )
    restoreFetch()
  })

  it("still sets RUNNING when the ingress readiness check throws", async () => {
    ingressReadinessImpl = async () => {
      throw new Error("kube api unreachable")
    }
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
    expect(result.status?.healthStatus).toBe("Healthy")
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

  it("getArgoCdApplicationStatus throws when API response is not ok", async () => {
    setupFetch({
      ok: false,
      status: 500,
      body: { message: "Internal server error" },
    })

    await expect(
      getArgoCdApplicationStatus(
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
    ).rejects.toThrow("ArgoCD API error 500")
    restoreFetch()
  })
  it("returns no completion when resolveClusterIntegration throws", async () => {
    resolveClusterIntegrationMock = async () => {
      throw new Error("Cluster integration not found")
    }
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-missing-cluster",
      status: "DEPLOYING",
      argocdSynced: false,
      completedAt: null,
      startedAt: new Date(),
      createdAt: new Date(),
      stack: { id: "stack-1", slug: "app-test" },
    })

    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(false)
    expect(result.status).toBeNull()
  })
  it("marks deployment as FAILED when rollout exceeds 15-minute timeout", async () => {
    setupFetch({ ok: true, body: {} })
    const fifteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000)
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-1",
      status: "DEPLOYING",
      argocdSynced: false,
      completedAt: null,
      startedAt: fifteenMinutesAgo,
      createdAt: fifteenMinutesAgo,
      stack: { id: "stack-1", slug: "app-test" },
    })

    const result = await pollDeploymentRollout("deploy-1")
    expect(result.completed).toBe(true)
    expect(result.status).toBeNull()
    expect(mockTx.applicationDeployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "deploy-1" },
        data: expect.objectContaining({
          status: "FAILED",
          failureReason:
            "ArgoCD rollout timed out after 15 minutes. Check cluster sync and pod status.",
        }),
      })
    )
    expect(mockTx.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stack-1" },
        data: expect.objectContaining({
          lastDeployStatus: "FAILED",
        }),
      })
    )
    restoreFetch()
  })
})
