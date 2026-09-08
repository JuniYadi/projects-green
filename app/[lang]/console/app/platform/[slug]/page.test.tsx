import { afterEach, describe, expect, it, mock } from "bun:test"

let mockSearchParams = new Map<string, string>([["tab", "env"]])

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", slug: "hermes-vibrant-comet" }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}))

const mockStack = {
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
  currentStepLabel: "Live",
  currentStepIndex: 4,
  currentStepStartedAt: new Date().toISOString(),
}

const appsProxy = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (prop === "get") {
        return mock(async () => ({
          data: {
            ok: true,
            data: [mockStack],
          },
        }))
      }
      return {
        get: mock(async () => ({
          data: {
            ok: true,
            data: {
              stack: mockStack,
              latestDeployment: null,
            },
          },
        })),
        env: {
          get: mock(async () => ({
            data: {
              ok: true,
              data: [],
            },
          })),
        },
        deployments: {
          get: mock(async () => ({
            data: {
              ok: true,
              data: [],
              meta: { total: 0, totalPages: 1, page: 1, pageSize: 20 },
            },
          })),
        },
        sync: {
          post: mock(async () => ({
            data: {
              ok: true,
            },
          })),
        },
      }
    },
  }
)

mock.module("@/lib/eden", () => ({
  getApiBaseUrl: () => "http://localhost:3300",
  eden: {
    api: {
      deploy: {
        apps: appsProxy,
      },
    },
  },
}))

// Dynamic import after mocks per AGENTS.md
const { cleanup, render, waitFor } = await import("@testing-library/react")
const { default: PlatformInstanceWorkspacePage } = await import("./page")

describe("PlatformInstanceWorkspacePage (/console/app/platform/[slug])", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders platform workspace with vertical settings subnav when tab=env", async () => {
    mockSearchParams = new Map([["tab", "env"]])
    const { queryByText, getAllByText, getByRole } = render(
      <PlatformInstanceWorkspacePage />
    )

    await waitFor(() => {
      expect(queryByText("Back to Platforms Dashboard")).toBeNull()
      expect(getAllByText("Hermes Comet").length).toBeGreaterThan(0)
      expect(getAllByText("Environment Variables").length).toBeGreaterThan(0)
      expect(
        getByRole("navigation", { name: "Platform Settings" })
      ).toBeDefined()
      expect(queryByText("Domains & SSL")).not.toBeNull()
      expect(queryByText("Scaling & Resources")).not.toBeNull()
      expect(queryByText("Danger Zone")).not.toBeNull()
    })
  })

  it("falls back to env subtab when section parameter is invalid", async () => {
    mockSearchParams = new Map([
      ["tab", "settings"],
      ["section", "nonexistent-bogus-section"],
    ])
    const { getAllByText, getByRole } = render(
      <PlatformInstanceWorkspacePage />
    )

    await waitFor(() => {
      expect(
        getByRole("navigation", { name: "Platform Settings" })
      ).toBeDefined()
      expect(getAllByText("Environment Variables").length).toBeGreaterThan(0)
    })
  })
})
