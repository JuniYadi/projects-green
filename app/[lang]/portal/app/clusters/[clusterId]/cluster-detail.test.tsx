import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

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

    expect(view.getByText(/us-east-1/)).toBeTruthy()
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
