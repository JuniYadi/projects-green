import { afterEach, describe, expect, it, mock } from "bun:test"

let mockSearchParams: Record<string, string> = { tab: "env" }

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", slug: "hermes-vibrant-comet" }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] ?? null,
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
        history: {
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

// Dynamic import required here to evaluate page after mock.module registrations
const { cleanup, render, waitFor } = await import("@testing-library/react")
const {
  default: PlatformInstanceWorkspacePage,
  VALID_SETTINGS_SUBTABS,
  resolveSettingsSubTab,
} = await import("./page")

describe("PlatformInstanceWorkspacePage - SettingsSubTabs validation", () => {
  it("includes all expected subtabs in VALID_SETTINGS_SUBTABS", () => {
    expect(VALID_SETTINGS_SUBTABS).toEqual([
      "env",
      "domains",
      "scaling",
      "mounts",
      "build",
      "danger",
    ])
  })

  it("strictly excludes 'general' from VALID_SETTINGS_SUBTABS", () => {
    expect(VALID_SETTINGS_SUBTABS as readonly string[]).not.toContain("general")
  })

  it("resolves valid subtabs correctly", () => {
    for (const tab of VALID_SETTINGS_SUBTABS) {
      expect(resolveSettingsSubTab(tab)).toBe(tab)
    }
  })

  it("falls back deprecated 'general' section to 'env'", () => {
    expect(resolveSettingsSubTab("general")).toBe("env")
  })

  it("falls back null, undefined, or unknown sections to 'env'", () => {
    expect(resolveSettingsSubTab(null)).toBe("env")
    expect(resolveSettingsSubTab(undefined)).toBe("env")
    expect(resolveSettingsSubTab("unknown-section")).toBe("env")
    expect(resolveSettingsSubTab("")).toBe("env")
  })
})

describe("PlatformInstanceWorkspacePage (/console/app/platform/[slug])", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders platform workspace with vertical settings subnav without general subtab", async () => {
    mockSearchParams = { tab: "env" }
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
      expect(queryByText("General Info")).toBeNull()
    })
  })

  it("falls back to env subtab when section=general is provided in searchParams", async () => {
    mockSearchParams = {
      tab: "settings",
      section: "general",
    }
    const { getAllByText, getByRole, queryByText } = render(
      <PlatformInstanceWorkspacePage />
    )

    await waitFor(() => {
      expect(
        getByRole("navigation", { name: "Platform Settings" })
      ).toBeDefined()
      expect(getAllByText("Environment Variables").length).toBeGreaterThan(0)
      expect(queryByText("General Info")).toBeNull()
    })
  })

  it("falls back to env subtab when section parameter is invalid", async () => {
    mockSearchParams = {
      tab: "settings",
      section: "nonexistent-bogus-section",
    }
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
