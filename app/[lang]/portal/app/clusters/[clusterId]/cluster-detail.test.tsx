import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"

import { ClusterDetail } from "./cluster-detail"

const mockPush = mock(() => {})
const mockReplace = mock((_href: string, _options?: unknown) => {})
const mockSearchParams = new URLSearchParams()
const mockLocale = { value: "en" }
mock.module("next/navigation", () => ({
  useParams: () => ({ lang: mockLocale.value }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))
const mockGetCluster = mock(async (): Promise<unknown> => ({
  ok: true,
  data: { ok: true, data: MOCK_CLUSTER },
}))
const mockGetEndpoint = mock(async (): Promise<unknown> => ({
  ok: true,
  data: { ok: true, data: MOCK_ENDPOINT },
}))
const mockPutEndpoint = mock(async (body: unknown): Promise<unknown> => ({
  ok: true,
  data: {
    ok: true,
    data: { ...MOCK_ENDPOINT, ...(body as Record<string, unknown>) },
  },
}))
const mockPatchCluster = mock(async (_body: unknown): Promise<unknown> => ({
  ok: true,
  data: { ok: true, data: MOCK_CLUSTER },
}))
const mockGetRegions = mock(async (): Promise<unknown> => ({
  ok: true,
  data: { ok: true, data: MOCK_REGIONS },
}))
const mockTestIntegration = mock(async (_body: unknown): Promise<unknown> => ({
  ok: true,
  data: {
    ok: true,
    data: {
      ok: true,
      message: "Successfully reached Jenkins server",
      durationMs: 42,
    },
  },
}))
const mockGetOperations = mock(async (view: string, _query: unknown) => ({
  data: await responseForOperation(
    `http://localhost/api/admin/app-hosting/clusters/cl_1/operations/${view}`
  ).json(),
}))
mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        regions: {
          get: mockGetRegions,
        },
        "app-hosting": {
          clusters: {
            cl_1: {
              get: mockGetCluster,
              patch: mockPatchCluster,
              endpoint: {
                get: mockGetEndpoint,
                put: mockPutEndpoint,
              },
              operations: new Proxy(
                {},
                {
                  get: (_target, view) => ({
                    get: (options: unknown) =>
                      mockGetOperations(String(view), options),
                  }),
                }
              ),
              integrations: {
                JENKINS: {
                  test: { post: mockTestIntegration },
                },
              },
            },
          },
        },
      },
    },
  },
}))
afterEach(() => {
  cleanup()
  mock.restore()
})
const MOCK_CLUSTER = {
  id: "cl_1",
  code: "us-east-1",
  name: "US East",
  region: "us-east-1",
  status: "ACTIVE" as const,
  isDefault: true,
  metadataJson: null,
  integrations: [
    {
      id: "int_1",
      type: "JENKINS" as const,
      metaJson: { baseUrl: "https://jenkins.example.com" },
      secretPreview: "****",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "int_2",
      type: "GITOPS" as const,
      metaJson: { repo: "acme/gitops", branch: "main" },
      secretPreview: null,
      isActive: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}
const MOCK_REGIONS = [
  {
    id: "reg-1",
    code: "US_EAST",
    name: "US East",
    country: "US",
    flag: "🇺🇸",
    isActive: true,
  },
]

const MOCK_ENDPOINT = {
  managedBaseDomain: "apps.us-east.example.com",
  cnameTarget: "edge.us-east.example.com",
  ipv4Addresses: ["203.0.113.10", "203.0.113.11"],
  ipv6Addresses: ["2001:db8::10"],
  isActive: true,
}

function responseForClusterOrEndpoint(
  input: RequestInfo | URL,
  endpoint = MOCK_ENDPOINT
) {
  const url = String(input)
  if (url.includes("/operations/")) {
    return responseForOperation(input)
  }
  if (url.endsWith("/regions")) {
    return Response.json({ ok: true, data: MOCK_REGIONS })
  }
  return url.endsWith("/endpoint")
    ? Response.json({ ok: true, data: endpoint })
    : Response.json({ ok: true, data: MOCK_CLUSTER })
}

const providerState = {
  state: "live",
  source: "test provider",
  observedAt: "2026-01-01T00:00:00.000Z",
  staleAfter: "2026-01-01T00:05:00.000Z",
  message: null,
  retryable: true,
} as const
let healthScenario: "healthy" | "unknown" | "unverified" | "degraded" =
  "healthy"

function responseForOperation(input: RequestInfo | URL) {
  const view = String(input).split("/operations/")[1]?.split("?")[0]
  if (view === "health") {
    const configOnlyProvider = {
      ...providerState,
      state: "configuration_only" as const,
      observedAt: null,
      staleAfter: null,
      message: "Integration is not configured.",
      retryable: false,
    }
    const unavailableProvider = {
      ...providerState,
      state: "unavailable" as const,
      message: "Provider unavailable",
    }
    const providers =
      healthScenario === "unknown"
        ? {
            kubernetes: configOnlyProvider,
            opensearch: configOnlyProvider,
            argocd: configOnlyProvider,
            jenkins: configOnlyProvider,
            prometheus: configOnlyProvider,
          }
        : healthScenario === "unverified"
          ? {
              kubernetes: configOnlyProvider,
              opensearch: providerState,
              argocd: providerState,
              jenkins: providerState,
              prometheus: providerState,
            }
          : healthScenario === "degraded"
            ? {
                kubernetes: configOnlyProvider,
                opensearch: unavailableProvider,
                argocd: configOnlyProvider,
                jenkins: configOnlyProvider,
                prometheus: configOnlyProvider,
              }
            : {
                kubernetes: providerState,
                opensearch: providerState,
                argocd: providerState,
                jenkins: providerState,
                prometheus: providerState,
              }
    const status = healthScenario
    return Response.json({
      ok: true,
      data: {
        provider: providerState,
        status,
        nodes:
          status === "healthy"
            ? { ready: 2, total: 2 }
            : { ready: null, total: null },
        workloads:
          status === "healthy"
            ? { ready: 4, total: 4 }
            : { ready: null, total: null },
        recentDeployment: null,
        providers,
      },
    })
  }
  if (view === "logs") {
    return Response.json({
      ok: true,
      data: {
        provider: providerState,
        source: "application",
        indexPatterns: ["app-*"],
        total: 1,
        totalIsLowerBound: false,
        tookMs: 3,
        services: ["api"],
        entries: [
          {
            id: "log-1",
            timestamp: "2026-01-01T00:00:00.000Z",
            severity: "30",
            severityLabel: "INFO",
            service: "api",
            namespace: "app-test",
            route: "/health",
            status: 200,
            message: "provider log",
          },
        ],
      },
    })
  }
  if (view === "deployments") {
    return Response.json({
      ok: true,
      data: {
        provider: providerState,
        deployments: [
          {
            application: "api",
            syncState: "Synced",
            health: "Healthy",
            revision: "abc123",
            author: null,
            message: null,
            observedAt: "2026-01-01T00:00:00.000Z",
            failureReason: null,
          },
        ],
      },
    })
  }
  if (view === "builds") {
    return Response.json({
      ok: true,
      data: {
        provider: providerState,
        scope: "cluster",
        scopeFilter: "pfnapp/Jenkins",
        builds: [
          {
            job: "api-build",
            status: "SUCCESS",
            branch: "main",
            commit: "abc123",
            durationMs: 1200,
            startedAt: "2026-01-01T00:00:00.000Z",
            artifactCount: 1,
            url: null,
          },
        ],
      },
    })
  }
  return Response.json({
    ok: true,
    data: {
      provider: providerState,
      range: "1h",
      seriesFound: 1,
      seriesTotal: 2,
      metrics: [
        {
          name: "cpu_usage",
          value: 1.2,
          unit: "cores",
          sampleAt: "2026-01-01T00:00:00.000Z",
          capacity: 12,
          series: [
            [1767225600, 1.1],
            [1767225660, 1.2],
          ],
          matchedQuery: "sum(rate(container_cpu_usage_seconds_total[5m]))",
          missingSeries: [],
        },
        {
          name: "request_rate",
          value: null,
          unit: "requests/s",
          sampleAt: null,
          capacity: null,
          series: [],
          matchedQuery: null,
          missingSeries: ["http_requests_total"],
        },
      ],
    },
  })
}

beforeEach(() => {
  mockLocale.value = "en"
  healthScenario = "healthy"
  mockReplace.mockClear()
  mockPush.mockClear()
  globalThis.fetch = mock(async (input) =>
    String(input).includes("/operations/")
      ? responseForOperation(input)
      : responseForClusterOrEndpoint(input)
  ) as unknown as typeof fetch
})
describe("ClusterDetail endpoint", () => {
  it("loads the region-specific edge endpoint configuration", async () => {
    globalThis.fetch = mock(async (input) =>
      responseForClusterOrEndpoint(input)
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByLabelText("Managed Base Domain")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(
      (view.getByLabelText("Managed Base Domain") as HTMLInputElement).value
    ).toBe(MOCK_ENDPOINT.managedBaseDomain)
    expect(
      (view.getByLabelText("CNAME Target") as HTMLInputElement).value
    ).toBe(MOCK_ENDPOINT.cnameTarget)
    expect(
      (view.getByLabelText("IPv4 Addresses") as HTMLTextAreaElement).value
    ).toBe(MOCK_ENDPOINT.ipv4Addresses.join("\n"))
    expect(
      (view.getByLabelText("IPv6 Addresses") as HTMLTextAreaElement).value
    ).toBe(MOCK_ENDPOINT.ipv6Addresses.join("\n"))
    expect(
      (view.getByLabelText("Endpoint Active") as HTMLInputElement).checked
    ).toBe(true)
  })

  it("saves endpoint fields through the admin endpoint API", async () => {
    let putCalled = false
    mockPutEndpoint.mockImplementation(async (body: unknown) => {
      putCalled = true
      return {
        ok: true,
        data: {
          ok: true,
          data: { ...MOCK_ENDPOINT, ...(body as Record<string, unknown>) },
        },
      }
    })

    const view = render(<ClusterDetail clusterId="cl_1" />)
    await waitFor(
      () => expect(view.getByLabelText("CNAME Target")).toBeTruthy(),
      { timeout: 5000 }
    )

    await act(async () => {
      fireEvent.change(view.getByLabelText("Managed Base Domain"), {
        target: { value: "apps.eu.example.com" },
      })
      fireEvent.change(view.getByLabelText("IPv4 Addresses"), {
        target: { value: "198.51.100.10\n198.51.100.11" },
      })
    })
    fireEvent.click(view.getByRole("button", { name: /save endpoint/i }))

    await waitFor(() => expect(putCalled).toBe(true), { timeout: 5000 })
  })
  it("shows endpoint field errors returned by the API", async () => {
    mockPutEndpoint.mockImplementationOnce(async () => ({
      data: {
        ok: false,
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: { cnameTarget: ["CNAME target is invalid"] },
      },
    }))

    const view = render(<ClusterDetail clusterId="cl_1" />)
    await waitFor(
      () => expect(view.getByLabelText("CNAME Target")).toBeTruthy(),
      { timeout: 5000 }
    )

    fireEvent.click(view.getByRole("button", { name: /save endpoint/i }))

    await waitFor(
      () => expect(view.getByText("CNAME target is invalid")).toBeTruthy(),
      { timeout: 5000 }
    )
  })

  it("shows endpoint load errors without hiding cluster metadata", async () => {
    mockGetEndpoint.mockImplementationOnce(async () => ({
      data: {
        ok: false,
        data: null,
        message: "Endpoint configuration unavailable",
      },
    }))

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () =>
        expect(
          view.getByText("Endpoint configuration unavailable")
        ).toBeTruthy(),
      { timeout: 5000 }
    )
  })
})

describe("ClusterDetail", () => {
  it("shows loading state", () => {
    mockGetCluster.mockImplementationOnce(() => new Promise(() => {}))

    const view = render(<ClusterDetail clusterId="cl_1" />)
    expect(view.getByText("Loading cluster\u2026")).toBeTruthy()
  })

  it("shows error state", async () => {
    mockGetCluster.mockImplementationOnce(async () => ({
      ok: false,
      message: "Unable to load cluster.",
    }))

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByRole("alert")).toBeTruthy()
      },
      { timeout: 5000 }
    )
    expect(view.getByText("Unable to load cluster.")).toBeTruthy()
  })
  it("renders cluster metadata", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("US East")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(view.getAllByText(/us-east-1/).length).toBeGreaterThanOrEqual(1)
    expect(view.getAllByText("Active").length).toBeGreaterThanOrEqual(1)
    expect(view.getAllByText("Default").length).toBeGreaterThanOrEqual(1)
  })

  it("renders editable cluster metadata fields", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByLabelText("Name")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect((view.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "US East"
    )
  })

  it("renders integration list with status", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("Jenkins")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(view.getByText("GitOps")).toBeTruthy()
  })

  it("offers missing integration types for configuration", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(
          view.getByRole("button", { name: /add integration/i })
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("shows masked secret preview", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("****")).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("shows empty integrations message", async () => {
    mockGetCluster.mockImplementationOnce(async () => ({
      ok: true,
      data: {
        ok: true,
        data: {
          ...MOCK_CLUSTER,
          integrations: [],
        },
      },
    }))

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText(/no integrations configured/i)).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("opens integration edit form with blank secret fields", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("Jenkins")).toBeTruthy()
      },
      { timeout: 5000 }
    )
    fireEvent.click(
      view.getAllByRole("button", { name: /edit|configure/i })[0]!
    )

    await waitFor(
      () => {
        expect(view.getByLabelText(/webhook token/i)).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("opens add modal for the remaining available integration type when only one is left", async () => {
    mockGetCluster.mockImplementationOnce(async () => ({
      ok: true,
      data: {
        ok: true,
        data: {
          ...MOCK_CLUSTER,
          integrations: [
            {
              id: "int_jenkins",
              type: "JENKINS" as const,
              metaJson: { baseUrl: "https://jenkins.example.com" },
              secretPreview: "****",
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "int_gitops",
              type: "GITOPS" as const,
              metaJson: { repo: "acme/gitops", branch: "main" },
              secretPreview: null,
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "int_registry",
              type: "REGISTRY" as const,
              metaJson: {},
              secretPreview: null,
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "int_argocd",
              type: "ARGOCD" as const,
              metaJson: {},
              secretPreview: null,
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "int_kubeconfig",
              type: "KUBECONFIG" as const,
              metaJson: {},
              secretPreview: null,
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "int_prometheus",
              type: "PROMETHEUS" as const,
              metaJson: {},
              secretPreview: null,
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    }))

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(
          view.getByRole("button", { name: /add integration/i })
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )

    fireEvent.click(view.getByRole("button", { name: /add integration/i }))

    await waitFor(
      () => {
        expect(
          view.getByRole("heading", { name: "Add OpenSearch" })
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("tests integration from the table row without sending plaintext secrets", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("Jenkins")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    const testButton = view.getAllByRole("button", {
      name: /test configuration/i,
    })[0]!
    fireEvent.click(testButton)

    await waitFor(
      () => {
        expect(mockTestIntegration).toHaveBeenCalledWith({
          metaJson: {},
          secrets: {},
        })
      },
      { timeout: 5000 }
    )

    await waitFor(
      () => {
        expect(
          view.getAllByText(/Successfully reached Jenkins server/)[0]
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })
  it("renders the truthful operation tabs", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        for (const label of [
          "Health",
          "Logs",
          "Deployments",
          "Builds",
          "Metrics",
          "Settings",
        ]) {
          expect(view.getByRole("tab", { name: label })).toBeTruthy()
        }
      },
      { timeout: 5000 }
    )
  })

  it("loads provider-backed logs and exposes source selection", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => expect(view.getByRole("tab", { name: "Logs" })).toBeTruthy(),
      { timeout: 5000 }
    )
    const logsTab = view.getByRole("tab", { name: "Logs" })
    fireEvent.pointerDown(logsTab)
    fireEvent.click(logsTab)
    fireEvent.mouseDown(logsTab)

    await waitFor(
      () => {
        expect(view.getByText("provider log")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    // The severity column shows the label, never the raw pino number.
    expect(
      view.getAllByText("INFO").some((node) => node.tagName === "TD")
    ).toBe(true)
    expect(view.queryByText("30")).toBeNull()
    expect(view.getByText(/Showing 1 of 1 events in app-\*/)).toBeTruthy()

    const sourceSelect = view.getByRole("combobox", { name: "Source" })
    expect((sourceSelect as HTMLSelectElement).value).toBe("application")
    fireEvent.change(sourceSelect, { target: { value: "http" } })
    expect((sourceSelect as HTMLSelectElement).value).toBe("http")
  })

  it("renders Argo CD deployment observations", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)
    const deploymentsTab = await waitFor(() =>
      view.getByRole("tab", { name: "Deployments" })
    )
    fireEvent.pointerDown(deploymentsTab)
    fireEvent.mouseDown(deploymentsTab)
    fireEvent.click(deploymentsTab)

    await waitFor(
      () => {
        expect(view.getByText("Argo CD application state")).toBeTruthy()
        expect(view.getByText("api")).toBeTruthy()
        expect(view.getByText("Synced")).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("renders Jenkins build observations", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)
    const buildsTab = await waitFor(() =>
      view.getByRole("tab", { name: "Builds" })
    )
    fireEvent.pointerDown(buildsTab)
    fireEvent.mouseDown(buildsTab)
    fireEvent.click(buildsTab)

    await waitFor(
      () => {
        expect(view.getByText("Jenkins builds")).toBeTruthy()
        expect(view.getByText("api-build")).toBeTruthy()
        expect(view.getByText("SUCCESS")).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("renders Prometheus metric observations", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)
    const metricsTab = await waitFor(() =>
      view.getByRole("tab", { name: "Metrics" })
    )
    fireEvent.pointerDown(metricsTab)
    fireEvent.mouseDown(metricsTab)
    fireEvent.click(metricsTab)

    await waitFor(
      () => {
        // A capacity reading carries its denominator.
        expect(view.getByText(/1\.20 cores/)).toBeTruthy()
        expect(view.getByText(/of 12\.00 cores/)).toBeTruthy()
        // An empty tile names the series that is missing.
        expect(
          view.getByText("http_requests_total is not exported by this cluster")
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("executes Test All Integrations from the header", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(
          view.getByRole("button", { name: /test all integrations/i })
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )

    fireEvent.click(
      view.getByRole("button", { name: /test all integrations/i })
    )

    await waitFor(
      () => {
        expect(mockTestIntegration).toHaveBeenCalled()
      },
      { timeout: 5000 }
    )
  })
  it("renders one onboarding card for unknown provider health", async () => {
    healthScenario = "unknown"
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => expect(view.getByText("No provider connections yet")).toBeTruthy(),
      { timeout: 5000 }
    )
    expect(
      view.getByRole("button", { name: "Configure integrations" })
    ).toBeTruthy()
    expect(view.queryByText("Providers")).toBeNull()
    expect(view.queryByText("Refresh data")).toBeNull()

    fireEvent.click(
      view.getByRole("button", { name: "Configure integrations" })
    )
    expect(mockReplace).toHaveBeenCalledWith("?tab=settings", { scroll: false })
  })

  it("keeps live capabilities visible when Kubernetes health is unverified", async () => {
    healthScenario = "unverified"
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () =>
        expect(view.getByText("Kubernetes health is unavailable")).toBeTruthy(),
      { timeout: 5000 }
    )
    expect(view.getByText("4 of 5 provider connections are live.")).toBeTruthy()
    expect(view.getByText(/Logs.*Deployments.*Builds.*Metrics/)).toBeTruthy()
    expect(
      view.getByRole("button", { name: "Review Kubernetes setup" })
    ).toBeTruthy()
  })

  it("renders degraded diagnostics instead of onboarding for a zero-live outage", async () => {
    healthScenario = "degraded"
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => expect(view.getByText("OpenSearch is unavailable.")).toBeTruthy(),
      { timeout: 5000 }
    )
    expect(view.queryByText("No provider connections yet")).toBeNull()
  })

  it("renders health guidance and settings labels in Indonesian", async () => {
    mockLocale.value = "id"
    healthScenario = "unverified"
    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () =>
        expect(
          view.getByText("Kesehatan Kubernetes belum tersedia")
        ).toBeTruthy(),
      { timeout: 5000 }
    )
    expect(view.getByText("4 dari 5 koneksi penyedia aktif.")).toBeTruthy()
    expect(view.getByRole("tab", { name: "Pengaturan" })).toBeTruthy()
  })

  it("gives dynamic integration fields stable accessible identifiers", async () => {
    const view = render(<ClusterDetail clusterId="cl_1" />)
    await waitFor(() => expect(view.getByText("Jenkins")).toBeTruthy(), {
      timeout: 5000,
    })

    fireEvent.click(view.getAllByRole("button", { name: /edit/i })[0]!)
    const webhookToken = await waitFor(() =>
      view.getByLabelText(/webhook token/i)
    )
    expect(webhookToken.id).toBe("int-secret-webhookToken")
    expect(webhookToken.getAttribute("name")).toBe(
      "integration.secrets.webhookToken"
    )
  })
})
