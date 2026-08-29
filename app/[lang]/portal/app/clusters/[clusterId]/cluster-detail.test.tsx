import { afterEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"

import { ClusterDetail } from "./cluster-detail"

const mockPush = mock(() => {})

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush }),
}))
const mockGetCluster = mock(
  async (): Promise<unknown> => ({
    ok: true,
    data: { ok: true, data: MOCK_CLUSTER },
  })
)
const mockGetEndpoint = mock(
  async (): Promise<unknown> => ({
    ok: true,
    data: { ok: true, data: MOCK_ENDPOINT },
  })
)
const mockPutEndpoint = mock(
  async (body: unknown): Promise<unknown> => ({
    ok: true,
    data: {
      ok: true,
      data: { ...MOCK_ENDPOINT, ...(body as Record<string, unknown>) },
    },
  })
)
const mockPatchCluster = mock(
  async (_body: unknown): Promise<unknown> => ({
    ok: true,
    data: { ok: true, data: MOCK_CLUSTER },
  })
)
const mockGetRegions = mock(
  async (): Promise<unknown> => ({
    ok: true,
    data: { ok: true, data: MOCK_REGIONS },
  })
)
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
  if (url.endsWith("/regions")) {
    return Response.json({ ok: true, data: MOCK_REGIONS })
  }
  return url.endsWith("/endpoint")
    ? Response.json({ ok: true, data: endpoint })
    : Response.json({ ok: true, data: MOCK_CLUSTER })
}
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
    expect(view.getByText("Loading cluster...")).toBeTruthy()
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
        expect(view.getByText(/Secret: \*\*\*\*/)).toBeTruthy()
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
})
