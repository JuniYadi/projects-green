import { describe, expect, it, mock, afterEach } from "bun:test"

// ─── Mock modules before any imports ─────────────────────────────────────────

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

mock.module("@phosphor-icons/react", () => ({
  RocketLaunch: (props: Record<string, unknown>) => (
    <span data-testid="icon-rocket" {...props} />
  ),
  ListMagnifyingGlass: (props: Record<string, unknown>) => (
    <span data-testid="icon-magnifying" {...props} />
  ),
  ChartLine: (props: Record<string, unknown>) => (
    <span data-testid="icon-chart" {...props} />
  ),
  ArrowSquareOut: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow" {...props} />
  ),
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: mock(() => ({
    console: {
      app: {
        overview: {
          heading: "App Platform",
          description: "Deploy and manage your applications.",
          deploy: "Deploy",
        },
        manage: {
          loadingApps: "Loading...",
          retry: "Retry",
          noApps: "No applications yet",
        },
      },
    },
  })),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        apps: {
          get: mock(() =>
            Promise.resolve({
              data: {
                ok: true,
                data: [
                  {
                    id: "1",
                    name: "test-app",
                    slug: "test-app",
                    status: "running",
                    framework: "Next.js",
                    branchName: "main",
                    subdomain: "test.example.com",
                    customDomain: null,
                    resourcePlanId: "starter",
                    billingMode: null,
                    billingState: "ACTIVE",
                    lastDeployedAt: "2026-01-01T00:00:00Z",
                    latestDeploymentId: null,
                  },
                ],
              },
            })
          ),
        },
      },
    },
  },
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

// ─── Dynamic imports after mocks ─────────────────────────────────────────────

const {
  render,
  waitFor,
  cleanup: rtlCleanup,
} = await import("@testing-library/react")
const { default: ApplicationsPage } = await import("./page")

afterEach(() => {
  rtlCleanup()
})

describe("ApplicationsPage overview", () => {
  it("renders heading and description from i18n", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("App Platform")).toBeDefined()
      expect(getByText("Deploy and manage your applications.")).toBeDefined()
    })
  })

  it("renders app name in the table after loading", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("test-app")).toBeDefined()
    })
  })

  it("renders status badge", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("Running")).toBeDefined()
    })
  })

  it("renders framework and branch", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("Next.js")).toBeDefined()
      expect(getByText("main")).toBeDefined()
    })
  })

  it("renders action links with correct hrefs", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      const logsLink = getByText("Logs").closest("a")
      const metricsLink = getByText("Metrics").closest("a")
      const eventsLink = getByText("Events").closest("a")
      const deployLink = getByText("Deploy").closest("a")

      expect(logsLink?.getAttribute("href")).toBe(
        "/en/console/app/logs?app=test-app"
      )
      expect(metricsLink?.getAttribute("href")).toBe(
        "/en/console/app/metrics?app=test-app"
      )
      expect(eventsLink?.getAttribute("href")).toBe(
        "/en/console/app/events?app=test-app"
      )
      expect(deployLink?.getAttribute("href")).toBe("/en/console/app/deploy")
    })
  })
})
