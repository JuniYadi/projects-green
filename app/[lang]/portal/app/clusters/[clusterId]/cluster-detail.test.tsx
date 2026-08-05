import { afterEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"

import { ClusterDetail } from "./cluster-detail"

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
  return String(input).endsWith("/endpoint")
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
    const requests: Array<{ method: string; body: string }> = []
    globalThis.fetch = mock(async (input, init) => {
      if (String(input).endsWith("/endpoint") && init?.method === "PUT") {
        requests.push({
          method: init.method,
          body: String(init.body),
        })
        return Response.json({ ok: true, data: MOCK_ENDPOINT })
      }
      return responseForClusterOrEndpoint(input)
    }) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)
    await waitFor(
      () => expect(view.getByLabelText("CNAME Target")).toBeTruthy(),
      {
        timeout: 5000,
      }
    )

    await act(async () => {
      fireEvent.change(view.getByLabelText("Managed Base Domain"), {
        target: { value: "apps.eu.example.com" },
      })
      fireEvent.change(view.getByLabelText("IPv4 Addresses"), {
        target: { value: "198.51.100.10\n198.51.100.11" },
      })
    })
    await waitFor(() => {
      expect(
        (view.getByLabelText("Managed Base Domain") as HTMLInputElement).value
      ).toBe("apps.eu.example.com")
      expect(
        (view.getByLabelText("IPv4 Addresses") as HTMLTextAreaElement).value
      ).toBe("198.51.100.10\n198.51.100.11")
    })
    fireEvent.click(view.getByRole("button", { name: /save endpoint/i }))

    await waitFor(() => expect(requests).toHaveLength(1), { timeout: 5000 })
    expect(requests[0]?.method).toBe("PUT")
    expect(JSON.parse(requests[0]?.body ?? "{}")).toEqual({
      managedBaseDomain: "apps.eu.example.com",
      cnameTarget: MOCK_ENDPOINT.cnameTarget,
      ipv4Addresses: ["198.51.100.10", "198.51.100.11"],
      ipv6Addresses: MOCK_ENDPOINT.ipv6Addresses,
      isActive: true,
    })
  })

  it("shows endpoint field errors returned by the API", async () => {
    globalThis.fetch = mock(async (input, init) => {
      if (String(input).endsWith("/endpoint") && init?.method === "PUT") {
        return Response.json(
          {
            ok: false,
            message: "Please fix the highlighted fields and try again.",
            fieldErrors: { cnameTarget: ["CNAME target is invalid"] },
          },
          { status: 422 }
        )
      }
      return responseForClusterOrEndpoint(input)
    }) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)
    await waitFor(
      () => expect(view.getByLabelText("CNAME Target")).toBeTruthy(),
      {
        timeout: 5000,
      }
    )

    fireEvent.click(view.getByRole("button", { name: /save endpoint/i }))

    await waitFor(
      () => expect(view.getByText("CNAME target is invalid")).toBeTruthy(),
      { timeout: 5000 }
    )
  })

  it("shows endpoint load errors without hiding cluster metadata", async () => {
    globalThis.fetch = mock(async (input) => {
      if (String(input).endsWith("/endpoint")) {
        return Response.json(
          { ok: false, message: "Endpoint configuration unavailable" },
          { status: 503 }
        )
      }
      return Response.json({ ok: true, data: MOCK_CLUSTER })
    }) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () =>
        expect(
          view.getByText("Endpoint configuration unavailable")
        ).toBeTruthy(),
      { timeout: 5000 }
    )
    expect(view.getByText("US East")).toBeTruthy()
  })
})
describe("ClusterDetail", () => {
  it("shows loading state", () => {
    globalThis.fetch = mock(
      () => new Promise<Response>(() => {})
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)
    expect(view.getByText("Loading cluster...")).toBeTruthy()
  })

  it("shows error state", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Not found")
    }) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByRole("alert")).toBeTruthy()
      },
      { timeout: 5000 }
    )
    expect(view.getByText("Not found")).toBeTruthy()
  })

  it("renders cluster metadata", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: MOCK_CLUSTER })
    ) as unknown as typeof fetch

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
    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: MOCK_CLUSTER })
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByLabelText("Name")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(view.getByLabelText("Name").getAttribute("value")).toBe("US East")
    expect(view.getByLabelText("Region").getAttribute("value")).toBe(
      "us-east-1"
    )
    expect(view.getByRole("button", { name: /save cluster/i })).toBeTruthy()
  })

  it("renders integration list with status", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: MOCK_CLUSTER })
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("Jenkins")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(view.getByText("GitOps")).toBeTruthy()

    const activeStatuses = view.getAllByText("Active")
    expect(activeStatuses.length).toBeGreaterThanOrEqual(1)

    expect(view.getByText("Inactive")).toBeTruthy()
  })

  it("offers missing integration types for configuration", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: MOCK_CLUSTER })
    ) as unknown as typeof fetch

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
    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: MOCK_CLUSTER })
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText(/Secret: \*\*\*\*/)).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("shows empty integrations message", async () => {
    const clusterNoIntegrations = {
      ...MOCK_CLUSTER,
      integrations: [],
    }

    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: clusterNoIntegrations })
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText(/no integrations/i)).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("opens integration edit form with blank secret fields", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ ok: true, data: MOCK_CLUSTER })
    ) as unknown as typeof fetch

    const view = render(<ClusterDetail clusterId="cl_1" />)

    await waitFor(
      () => {
        expect(view.getByText("Jenkins")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    const editButtons = view.getAllByRole("button", { name: /^Edit$/i })
    fireEvent.click(editButtons[0])

    expect(view.getByText(/Edit Jenkins/)).toBeTruthy()
    const secretInput = view.container.querySelector('input[type="password"]')
    expect(secretInput).toBeTruthy()
    expect((secretInput as HTMLInputElement | null)?.value).toBe("")
    expect(view.getByText(/not the PAT value/i)).toBeTruthy()
  })
})
