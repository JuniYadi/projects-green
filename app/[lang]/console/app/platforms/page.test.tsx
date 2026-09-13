import { afterEach, describe, expect, it, mock } from "bun:test"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

const mockApps = [
  {
    id: "stack-1",
    name: "Hermes Comet",
    slug: "hermes-vibrant-comet",
    status: "running",
    framework: "Node.js",
    branchName: "main",
    subdomain: "hermes-vibrant-comet",
    customDomain: null,
    resourcePlanId: "small",
    billingMode: "PAYG",
    billingState: "ACTIVE",
    lastDeployedAt: new Date().toISOString(),
    latestDeploymentId: "dep-1",
    currentStepLabel: "Application live",
    currentStepIndex: 4,
    currentStepStartedAt: new Date().toISOString(),
  },
  {
    id: "stack-2",
    name: "n8n Workflow",
    slug: "n8n-cosmic-nebula",
    status: "queued",
    framework: "n8n",
    branchName: "main",
    subdomain: "n8n-cosmic-nebula",
    customDomain: null,
    resourcePlanId: "small",
    billingMode: "PAYG",
    billingState: "ACTIVE",
    lastDeployedAt: null,
    latestDeploymentId: null,
    currentStepLabel: null,
    currentStepIndex: null,
    currentStepStartedAt: null,
  },
  {
    id: "stack-3",
    name: "Ghost Blog",
    slug: "ghost-blog",
    status: "running",
    framework: null,
    templateId: "cmtcagyzt0001o44cwzm30ldc",
    templateName: "Ghost",
    sourceType: "TEMPLATE",
    branchName: "main",
    subdomain: "ghost-blog.pfnapp.dev",
    customDomain: null,
    resourcePlanId: "small",
    billingMode: "PAYG",
    billingState: "ACTIVE",
    lastDeployedAt: "2026-09-10T00:00:00.000Z",
    latestDeploymentId: "dep-3",
    currentStepLabel: "Application live",
    currentStepIndex: 4,
    currentStepStartedAt: "2026-09-10T00:00:00.000Z",
  },
]

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        apps: {
          get: mock(async () => ({
            data: {
              ok: true,
              data: mockApps,
            },
          })),
        },
      },
    },
  },
}))

// Dynamic imports after mock.module()
const { cleanup, render, waitFor, fireEvent } =
  await import("@testing-library/react")
const { default: PlatformsFleetPage } = await import("./page")

describe("PlatformsFleetPage (/console/app/platforms)", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders Platforms Fleet heading and list of applications", async () => {
    const { getByText, getByRole } = render(<PlatformsFleetPage />)

    await waitFor(() => {
      expect(getByText("Platforms Fleet")).toBeDefined()
      expect(getByRole("link", { name: "Hermes Comet" })).toBeDefined()
      expect(getByRole("link", { name: "n8n Workflow" })).toBeDefined()
    })
  })

  it("filters platforms by status tabs (Running, Queued)", async () => {
    const { getByRole, queryByText } = render(<PlatformsFleetPage />)

    await waitFor(() => {
      expect(queryByText("Hermes Comet")).toBeDefined()
    })

    const runningFilterBtn = getByRole("button", { name: /^Running/i })
    fireEvent.click(runningFilterBtn)

    expect(queryByText("Hermes Comet")).toBeDefined()
    expect(queryByText("n8n Workflow")).toBeNull()
  })

  it("filters platforms by search input", async () => {
    const { getByPlaceholderText, queryByText } = render(<PlatformsFleetPage />)

    await waitFor(() => {
      expect(queryByText("Hermes Comet")).toBeDefined()
    })

    const searchInput = getByPlaceholderText("Search platforms...")
    fireEvent.change(searchInput, { target: { value: "n8n" } })

    expect(queryByText("Hermes Comet")).toBeNull()
    expect(queryByText("n8n Workflow")).toBeDefined()
  })

  it("displays template name instead of leaking raw database cuid", async () => {
    const { getByText, queryByText } = render(<PlatformsFleetPage />)

    await waitFor(() => {
      expect(getByText("Ghost Blog")).toBeDefined()
      // Template name should be rendered with Template badge
      expect(getByText("Ghost")).toBeDefined()
      expect(getByText("Template")).toBeDefined()
      // Raw CUID should NEVER be present in the document
      expect(queryByText("cmtcagyzt0001o44cwzm30ldc")).toBeNull()
    })
  })

  it("renders live domain link for running applications", async () => {
    const { getByRole } = render(<PlatformsFleetPage />)

    await waitFor(() => {
      const liveLink = getByRole("link", { name: /ghost-blog\.pfnapp\.dev/i })
      expect(liveLink).toBeDefined()
      expect(liveLink.getAttribute("href")).toBe(
        "https://ghost-blog.pfnapp.dev"
      )
    })
  })
})
