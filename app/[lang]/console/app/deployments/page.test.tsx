import { afterEach, describe, expect, it, mock } from "bun:test"

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ replace: mock(() => {}) })),
  usePathname: mock(() => "/en/console/app/deployments"),
  useSearchParams: mock(() => new URLSearchParams("app=demo-app")),
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: mock(() => ({
    console: {
      app: {
        manage: {
          heading: "Manage Application",
          description: "Monitor deployments.",
          loadingApps: "Loading apps…",
          loadingAppState: "Loading app…",
          noApps: "No applications yet",
          noAppsDescription: "Deploy an app first.",
          retry: "Retry",
        },
      },
    },
  })),
}))

mock.module("@/lib/i18n/pathname", () => ({
  resolveLocaleOrDefault: (lang: string | undefined) => lang || "en",
}))

mock.module("@/modules/deploy/ui/lifecycle-page-shell", () => ({
  LifecyclePageShell: ({
    title,
    description,
    children,
  }: {
    title: string
    description: string
    children: React.ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  ),
}))

const getApps = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: [
        {
          id: "stack-1",
          name: "Demo app",
          slug: "demo-app",
          status: "running",
          framework: "Next.js",
          branchName: "main",
          subdomain: "demo.example.com",
          customDomain: null,
          resourcePlanId: "starter",
          billingMode: null,
          billingState: "ACTIVE",
          lastDeployedAt: "2026-07-01T00:00:00.000Z",
          latestDeploymentId: "deploy-newest",
          currentStepLabel: "Deploy completed",
          currentStepIndex: 12,
          currentStepStartedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    },
  })
)

const getOverview = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: {
        stack: {
          id: "stack-1",
          name: "Demo app",
          slug: "demo-app",
          status: "running",
          framework: "Next.js",
          branchName: "main",
          subdomain: "demo.example.com",
          customDomain: null,
          resourcePlanId: "starter",
          billingMode: null,
          billingState: "ACTIVE",
          lastDeployedAt: "2026-07-01T00:00:00.000Z",
          latestDeploymentId: "deploy-newest",
          currentStepLabel: null,
          currentStepIndex: null,
          currentStepStartedAt: null,
        },
        latestDeployment: null,
      },
    },
  })
)

const getHistory = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: [
        {
          id: "deploy-newest",
          status: "failed",
          attempt: 2,
          durationMs: 12_500,
          commitSha: "abcdef1234567890",
          failureReason: "Build failed",
          startedAt: "2026-07-01T10:00:00.000Z",
          completedAt: "2026-07-01T10:00:12.500Z",
        },
        {
          id: "deploy-old",
          status: "running",
          attempt: 1,
          durationMs: null,
          commitSha: null,
          failureReason: null,
          startedAt: null,
          completedAt: null,
        },
      ],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    },
  })
)

const postTrigger = mock(() =>
  Promise.resolve({
    data: { ok: true, data: { deploymentId: "deploy-retry" } },
  })
)

const appsApi = new Proxy({ get: getApps } as Record<string, unknown>, {
  get(target, property: string) {
    return property === "get"
      ? target.get
      : { get: getOverview, history: { get: getHistory } }
  },
})
const triggerApi = new Proxy({} as Record<string, unknown>, {
  get() {
    return { post: postTrigger }
  },
})

mock.module("@/lib/eden", () => ({
  eden: { api: { deploy: { apps: appsApi, trigger: triggerApi } } },
}))

mock.module("@/modules/deploy/deploy.constants", () => ({
  DEPLOY_STATUS_LABELS: {
    running: "Running",
    failed: "Failed",
    building: "Building",
    deploying: "Deploying",
    queued: "Queued",
    idle: "Not started",
  },
}))

mock.module("@/modules/deploy/ui/operate/app-monitor", () => ({
  AppMonitor: ({
    deployment,
    onRetry,
  }: {
    deployment: { id: string; status: string; attempt: number } | null
    onRetry?: () => void
  }) => (
    <section>
      <span data-testid="selected-deployment">{deployment?.id ?? "none"}</span>
      {onRetry ? <button onClick={onRetry}>Retry</button> : null}
    </section>
  ),
}))

const { render, waitFor, cleanup } = await import("@testing-library/react")
const { default: DeploymentsPage } = await import("./page")

afterEach(() => {
  cleanup()
  getApps.mockClear()
  getOverview.mockClear()
  getHistory.mockClear()
  postTrigger.mockClear()
})

describe("DeploymentsPage", () => {
  it("loads history, selects newest attempt, and exposes failed retry", async () => {
    const view = render(<DeploymentsPage />)

    await waitFor(() => {
      expect(view.getByText("Deployments")).toBeDefined()
      expect(view.getByText("Build failed")).toBeDefined()
      expect(view.getByText("abcdef1")).toBeDefined()
      expect(view.getByTestId("selected-deployment").textContent).toBe(
        "deploy-newest"
      )
      expect(view.getByRole("button", { name: "Retry" })).toBeDefined()
    })

    view.getByRole("button", { name: "Retry" }).click()
    await waitFor(() => expect(postTrigger).toHaveBeenCalled())
  })

  it("selects a history row and removes retry for non-failed attempt", async () => {
    const view = render(<DeploymentsPage />)

    await waitFor(() => expect(getHistory).toHaveBeenCalled())
    view.getByText("#1").click()

    await waitFor(() =>
      expect(view.getByTestId("selected-deployment").textContent).toBe(
        "deploy-old"
      )
    )
    expect(view.queryByRole("button", { name: "Retry" })).toBeNull()
  })
})
