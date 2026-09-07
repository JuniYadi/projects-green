import { afterEach, describe, expect, it, mock } from "bun:test"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", slug: "hermes-vibrant-comet" }),
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? "env" : null),
  }),
  useRouter: () => ({ push: () => {} }),
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

  it("renders platform workspace with Environment variables tab when tab=env", async () => {
    const { getByText, getAllByText } = render(
      <PlatformInstanceWorkspacePage />
    )

    await waitFor(() => {
      expect(getByText("Back to Platforms Dashboard")).toBeDefined()
      expect(getByText("Hermes Comet")).toBeDefined()
      expect(getAllByText("Environment Variables").length).toBeGreaterThan(0)
    })
  })
})
