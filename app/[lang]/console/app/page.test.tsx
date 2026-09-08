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
  ArrowRight: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrowright" {...props} />
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

const defaultAppsList = [
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
    lastDeployedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    currentStepLabel: "Build started",
    currentStepIndex: 2,
    currentStepStartedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
]

const mockAppsGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: defaultAppsList,
    },
  })
)

const mockTelemetryGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: {
        clusterId: "id-cgk-1",
        clusterName: "Jakarta Production Cluster",
        region: "Jakarta (id-cgk-1)",
        isPrimary: true,
        timeRange: "1h",
        points: [],
        cpu: { currentCores: 1.2, limitCores: 4, avgCores: 1, peakCores: 2 },
        memory: {
          currentBytes: 2147483648,
          limitBytes: 8589934592,
          avgBytes: 2000000000,
          peakBytes: 3000000000,
        },
        network: {
          currentRxBytes: 1048576,
          currentTxBytes: 1048576,
          totalRxBytes: 10485760,
          totalTxBytes: 10485760,
        },
      },
    },
  })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        apps: {
          get: mockAppsGet,
        },
        telemetry: {
          get: mockTelemetryGet,
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
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query")
const { default: ApplicationsPage } = await import("./page")

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const renderWithClient = (ui: React.ReactElement) => {
  const client = createTestQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  rtlCleanup()
  mockAppsGet.mockImplementation(() =>
    Promise.resolve({
      data: {
        ok: true,
        data: defaultAppsList,
      },
    })
  )
})

describe("ApplicationsPage overview", () => {
  it("renders heading and description from i18n", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("App Platform")).toBeDefined()
      expect(getByText("Deploy and manage your applications.")).toBeDefined()
    })
  })

  it("renders app name as a link to app workspace overview", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      const appLink = getByText("test-app").closest("a")
      expect(appLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=overview"
      )
    })
  })

  it("renders status badge", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("Running")).toBeDefined()
    })
  })

  it("renders framework and branch in card", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText(/Next\.js/i)).toBeDefined()
      expect(getByText(/branch main/i)).toBeDefined()
    })
  })

  it("renders relative time in card footer", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText(/\d+ minutes ago|just now/i)).toBeDefined()
    })
  })

  it("renders platform card action links with correct hrefs", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      const deploymentsLink = getByText("Deployments").closest("a")
      const envLink = getByText("Env").closest("a")
      const viewAllLink = getByText("View all platforms").closest("a")

      expect(deploymentsLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=deployments"
      )
      expect(envLink?.getAttribute("href")).toBe(
        "/en/console/app/platform/test-app?tab=env"
      )
      expect(viewAllLink?.getAttribute("href")).toBe(
        "/en/console/app/platforms"
      )
    })
  })

  it("renders dashboard overview KPI stats, telemetry charts, and quick action buttons", async () => {
    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("Cluster Resource Telemetry")).toBeDefined()
      expect(getByText("CPU Utilization")).toBeDefined()
      expect(getByText("Memory Utilization")).toBeDefined()
      expect(getByText("Network I/O Throughput")).toBeDefined()
      expect(getByText("Total Platforms")).toBeDefined()
      expect(getByText("Active & Live")).toBeDefined()
      expect(getByText("Deploying / Queued")).toBeDefined()
      expect(getByText("Needs Attention")).toBeDefined()
      expect(getByText("Marketplace")).toBeDefined()
      expect(getByText("Deploy New App")).toBeDefined()
    })
  })

  it("renders cluster telemetry cards even when apps list is empty", async () => {
    mockAppsGet.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          ok: true,
          data: [],
        },
      })
    )

    const { getByText } = renderWithClient(<ApplicationsPage />)

    await waitFor(() => {
      expect(getByText("Cluster Resource Telemetry")).toBeDefined()
      expect(getByText("CPU Utilization")).toBeDefined()
      expect(getByText("Memory Utilization")).toBeDefined()
      expect(getByText("Network I/O Throughput")).toBeDefined()
      expect(getByText("No applications yet")).toBeDefined()
    })
  })
})
