import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationDeployment: {
    findUnique: mock(async () => ({
      id: "deploy-1",
      stackId: "stack-1",
      stack: { id: "stack-1", slug: "app-test" },
    })),
  },
}

let kubeConfigResponse:
  | {
      apiServerUrl: string | null
      caCertificate: string | null
      serviceAccountToken: string | null
      kubeconfig: string | null
      namespacePattern: string
      labelSelector: string
    }
  | Error

const resolveClusterIntegrationMock = mock(
  async (_id: string, type: string) => {
    if (type !== "KUBECONFIG") throw new Error("missing " + type)
    if (kubeConfigResponse instanceof Error) throw kubeConfigResponse
    return kubeConfigResponse
  }
)

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: resolveClusterIntegrationMock,
}))

const originalFetch = globalThis.fetch

const setupFetch = (
  responses: Array<{
    ok: boolean
    status?: number
    body?: unknown
  }>
) => {
  let i = 0
  const fetchMock = mock(async () => {
    const response = responses[i++] ?? { ok: false, status: 500, body: {} }
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      statusText: response.ok ? "OK" : "Error",
      json: async () => response.body ?? {},
    }
  })
  globalThis.fetch = fetchMock as any as typeof fetch
}

const restoreFetch = () => {
  globalThis.fetch = originalFetch
}

const { getDeploymentPods } = await import("./pod-status.service")

describe("pod-status.service", () => {
  beforeEach(() => {
    mockPrisma.applicationDeployment.findUnique.mockReset()
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-1",
      stack: { id: "stack-1", slug: "app-test" },
    })
    kubeConfigResponse = {
      apiServerUrl: "https://k8s.example.com",
      caCertificate: null,
      serviceAccountToken: "sa-token",
      kubeconfig: null,
      namespacePattern: "app-{slug}",
      labelSelector: "app={slug}",
    }
  })

  it("throws when deployment is missing", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(
      null as any
    )
    expect(getDeploymentPods("missing")).rejects.toThrow("Deployment not found")
  })

  it("returns empty array when kubeconfig integration missing", async () => {
    kubeConfigResponse = new Error("Missing KUBECONFIG integration")
    const pods = await getDeploymentPods("deploy-1")
    expect(pods).toEqual([])
  })

  it("returns empty array when kubeconfig credentials incomplete", async () => {
    kubeConfigResponse = {
      apiServerUrl: null,
      caCertificate: null,
      serviceAccountToken: null,
      kubeconfig: null,
      namespacePattern: "app-{slug}",
      labelSelector: "app={slug}",
    }
    const pods = await getDeploymentPods("deploy-1")
    expect(pods).toEqual([])
    expect(globalThis.fetch).toBe(originalFetch)
  })

  it("returns mapped pod DTOs without secrets", async () => {
    setupFetch([
      {
        ok: true,
        body: {
          items: [
            {
              metadata: { name: "pod-a" },
              status: {
                phase: "Running",
                containerStatuses: [
                  { ready: true, restartCount: 0 },
                  { ready: false, restartCount: 3 },
                ],
              },
            },
          ],
        },
      },
      { ok: false, status: 500 },
    ])
    const pods = await getDeploymentPods("deploy-1")
    expect(pods).toHaveLength(1)
    const pod = pods[0]
    expect(pod?.name).toBe("pod-a")
    expect(pod?.phase).toBe("Running")
    expect(pod?.readyContainers).toBe(1)
    expect(pod?.totalContainers).toBe(2)
    expect(pod?.restartCount).toBe(3)
    expect(pod?.latestWarningEvent).toBeNull()
    const serialized = JSON.stringify(pods)
    expect(serialized).not.toContain("sa-token")
    expect(serialized).not.toContain("kubeconfig")
    restoreFetch()
  })

  it("returns empty when pods API errors", async () => {
    setupFetch([{ ok: false, status: 500 }])
    const pods = await getDeploymentPods("deploy-1")
    expect(pods).toEqual([])
    restoreFetch()
  })

  it("captures latest warning event when events endpoint succeeds", async () => {
    setupFetch([
      {
        ok: true,
        body: {
          items: [
            {
              metadata: { name: "pod-a" },
              status: {
                phase: "Running",
                containerStatuses: [{ ready: true, restartCount: 0 }],
              },
            },
          ],
        },
      },
      {
        ok: true,
        body: {
          items: [
            {
              type: "Warning",
              involvedObject: { name: "pod-a" },
              message: "Backoff restarting failed container",
              lastTimestamp: "2026-06-05T10:00:00.000Z",
            },
          ],
        },
      },
    ])
    const pods = await getDeploymentPods("deploy-1")
    expect(pods[0]?.latestWarningEvent).toBe(
      "Backoff restarting failed container"
    )
    restoreFetch()
  })
})
