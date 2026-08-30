import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationDeployment: {
    findUnique: mock(async (..._args: unknown[]) => ({
      id: "deploy-1",
      stackId: "stack-1",
      stack: {
        id: "stack-1",
        slug: "app-test",
        customDomain: "example.com" as string | null,
      },
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

let fetchKubeJsonImpl: (...args: unknown[]) => Promise<unknown>
const fetchKubeJsonMock = mock((...args: unknown[]) =>
  fetchKubeJsonImpl(...args)
)

let dnsResolveCname: (hostname: string) => Promise<string[]>
let dnsResolve4: (hostname: string) => Promise<string[]>
let dnsResolve6: (hostname: string) => Promise<string[]>

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: resolveClusterIntegrationMock,
}))
mock.module("./cluster-integration.service", () => ({
  resolveClusterIntegration: resolveClusterIntegrationMock,
}))
mock.module("./pod-status.service", () => ({
  fetchKubeJson: fetchKubeJsonMock,
}))
mock.module("node:dns", () => ({
  promises: {
    resolveCname: (hostname: string) => dnsResolveCname(hostname),
    resolve4: (hostname: string) => dnsResolve4(hostname),
    resolve6: (hostname: string) => dnsResolve6(hostname),
  },
}))

const { checkIngressReadiness } = await import("./ingress-readiness.service")

describe("ingress-readiness.service", () => {
  beforeEach(() => {
    mockPrisma.applicationDeployment.findUnique.mockReset()
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-1",
      stack: { id: "stack-1", slug: "app-test", customDomain: "example.com" },
    })
    kubeConfigResponse = {
      apiServerUrl: "https://k8s.example.com",
      caCertificate: null,
      serviceAccountToken: "sa-token",
      kubeconfig: null,
      namespacePattern: "app-{slug}",
      labelSelector: "app={slug}",
    }
    fetchKubeJsonImpl = async () => ({
      status: { loadBalancer: { ingress: [{ ip: "203.0.113.10" }] } },
    })
    dnsResolveCname = async () => ["edge.example.net"]
    dnsResolve4 = async () => []
    dnsResolve6 = async () => []
  })

  it("passes when ingress has a load-balancer address and domain resolves", async () => {
    const result = await checkIngressReadiness("deploy-1")
    expect(result).toBe(true)
  })

  it("fails when the ingress has no load-balancer address yet", async () => {
    fetchKubeJsonImpl = async () => ({
      status: { loadBalancer: { ingress: [] } },
    })
    const result = await checkIngressReadiness("deploy-1")
    expect(result).toBe(false)
  })

  it("treats missing customDomain as a vacuously passed DNS check", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-1",
      stack: { id: "stack-1", slug: "app-test", customDomain: null },
    })
    dnsResolveCname = async () => {
      throw new Error("should not be called")
    }
    const result = await checkIngressReadiness("deploy-1")
    expect(result).toBe(true)
  })

  it("does not throw and treats a kube API error as not-yet-verified", async () => {
    fetchKubeJsonImpl = async () => {
      throw new Error("network error")
    }
    const result = await checkIngressReadiness("deploy-1")
    expect(result).toBe(false)
  })

  it("does not throw and treats a DNS resolution error as not-yet-verified", async () => {
    dnsResolveCname = async () => {
      throw new Error("ENOTFOUND")
    }
    dnsResolve4 = async () => {
      throw new Error("ENOTFOUND")
    }
    dnsResolve6 = async () => {
      throw new Error("ENOTFOUND")
    }
    const result = await checkIngressReadiness("deploy-1")
    expect(result).toBe(false)
  })

  it("returns false without throwing when the deployment is missing", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue(null as any)
    const result = await checkIngressReadiness("missing")
    expect(result).toBe(false)
  })
})
