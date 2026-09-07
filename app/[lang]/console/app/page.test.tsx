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
  GearSix: (props: Record<string, unknown>) => (
    <span data-testid="icon-gearsix" {...props} />
  ),
  Storefront: (props: Record<string, unknown>) => (
    <span data-testid="icon-storefront" {...props} />
  ),
  ArrowLeft: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrowleft" {...props} />
  ),
  CheckCircle: (props: Record<string, unknown>) => (
    <span data-testid="icon-checkcircle" {...props} />
  ),
  CaretUpDown: (props: Record<string, unknown>) => (
    <span data-testid="icon-caretupdown" {...props} />
  ),
  Gauge: (props: Record<string, unknown>) => (
    <span data-testid="icon-gauge" {...props} />
  ),
  ArrowsClockwise: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrowsclockwise" {...props} />
  ),
  Clock: (props: Record<string, unknown>) => (
    <span data-testid="icon-clock" {...props} />
  ),
  ShieldCheck: (props: Record<string, unknown>) => (
    <span data-testid="icon-shieldcheck" {...props} />
  ),
  Cpu: (props: Record<string, unknown>) => (
    <span data-testid="icon-cpu" {...props} />
  ),
  HardDrive: (props: Record<string, unknown>) => (
    <span data-testid="icon-harddrive" {...props} />
  ),
  ArrowsLeftRight: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrowsleftright" {...props} />
  ),
  Globe: (props: Record<string, unknown>) => (
    <span data-testid="icon-globe" {...props} />
  ),
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useSearchParams: mock(() => ({ get: () => null })),
  useRouter: mock(() => ({ push: () => {} })),
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
                    latestDeploymentId: "deployment-1",
                    currentStepLabel: "Build started",
                    currentStepIndex: 2,
                    currentStepStartedAt: new Date(
                      Date.now() - 5 * 60 * 1000
                    ).toISOString(),
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

  it("renders app name as a link to app workspace overview", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      const appLink = getByText("test-app").closest("a")
      expect(appLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=overview"
      )
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

  it("renders current deployment relative time", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText(/Build started — \d+ minutes ago/)).toBeDefined()
    })
  })

  it("renders action links with correct hrefs", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      const logsLink = getByText("Logs").closest("a")
      const metricsLink = getByText("Metrics").closest("a")
      const deploymentsLink = getByText("Deployments").closest("a")
      const settingsLink = getByText("Settings").closest("a")
      const deployLink = getByText("Deploy").closest("a")

      expect(logsLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=logs"
      )
      expect(metricsLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=metrics"
      )
      expect(deploymentsLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=deployments"
      )
      expect(settingsLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=env"
      )
      expect(deployLink?.getAttribute("href")).toBe("/en/console/app/deploy")
    })
  })

  it("renders dashboard overview KPI stats, telemetry charts, and quick action buttons", async () => {
    const { getByText } = render(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("Cluster Resource Telemetry")).toBeDefined()
      expect(getByText("CPU Utilization")).toBeDefined()
      expect(getByText("Memory Allocation")).toBeDefined()
      expect(getByText("Network I/O Throughput")).toBeDefined()
      expect(getByText("Total Platforms")).toBeDefined()
      expect(getByText("Active & Live")).toBeDefined()
      expect(getByText("Deploying / Queued")).toBeDefined()
      expect(getByText("Needs Attention")).toBeDefined()
      expect(getByText("Marketplace")).toBeDefined()
      expect(getByText("Deploy New App")).toBeDefined()
    })
  })
})
