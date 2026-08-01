import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"

import { ClusterList } from "./cluster-list"

afterEach(() => {
  cleanup()
  mock.restore()
})

const MOCK_CLUSTERS = [
  {
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
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cl_2",
    code: "eu-west-1",
    name: "EU West",
    region: "eu-west-1",
    status: "PLANNED" as const,
    isDefault: false,
    metadataJson: null,
    integrations: [],
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
]

describe("ClusterList", () => {
  it("shows loading state", () => {
    globalThis.fetch = mock(
      () => new Promise<Response>(() => {})
    ) as unknown as typeof fetch

    const view = render(<ClusterList />)
    expect(view.getByText("Loading clusters...")).toBeTruthy()
  })

  it("shows error state with retry button", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network error")
    }) as unknown as typeof fetch

    const view = render(<ClusterList />)

    await waitFor(
      () => {
        expect(view.getByRole("alert")).toBeTruthy()
      },
      { timeout: 5000 }
    )
    expect(view.getByText("Network error")).toBeTruthy()
    expect(view.getByRole("button", { name: /retry/i })).toBeTruthy()
  })

  it("shows empty state", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        ok: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
    ) as unknown as typeof fetch

    const view = render(<ClusterList />)

    await waitFor(
      () => {
        expect(view.getByText(/no clusters/i)).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })

  it("renders cluster rows with status badges", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        ok: true,
        data: MOCK_CLUSTERS,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      })
    ) as unknown as typeof fetch

    const view = render(<ClusterList />)

    await waitFor(
      () => {
        expect(view.getByText("US East")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(view.getByText("EU West")).toBeTruthy()
    expect(view.getAllByText("us-east-1")).toHaveLength(2)
    expect(view.getAllByText("eu-west-1")).toHaveLength(2)

    const activeBadges = view.getAllByText("Active")
    expect(activeBadges.length).toBeGreaterThanOrEqual(1)

    const plannedBadges = view.getAllByText("Planned")
    expect(plannedBadges.length).toBeGreaterThanOrEqual(1)

    expect(view.getAllByText("Default").length).toBeGreaterThanOrEqual(1)
  })

  it("links to cluster detail page", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        ok: true,
        data: MOCK_CLUSTERS,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      })
    ) as unknown as typeof fetch

    const view = render(<ClusterList />)

    await waitFor(
      () => {
        expect(view.getByText("US East")).toBeTruthy()
      },
      { timeout: 5000 }
    )

    const detailLinks = view.getAllByRole("link", { name: /view/i })
    expect(detailLinks.length).toBe(2)
    expect(detailLinks[0].getAttribute("href")).toContain("cl_1")
  })

  it("renders create cluster button", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        ok: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
    ) as unknown as typeof fetch

    const view = render(<ClusterList />)

    await waitFor(
      () => {
        expect(
          view.getByRole("button", { name: /create cluster/i })
        ).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })
})
