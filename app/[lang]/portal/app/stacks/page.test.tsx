import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    className,
    title,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    title?: string
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}))

const mockPush = mock(() => {})
const mockSearchParams = new URLSearchParams()
let mockLocale = "id"

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: mockLocale })),
  useRouter: mock(() => ({ push: mockPush })),
  useSearchParams: mock(() => mockSearchParams),
  usePathname: mock(() => `/${mockLocale}/portal/app/stacks`),
}))

const mockGetStacks = mock(async () => ({
  data: {
    ok: true,
    data: [
      {
        id: "stack_1",
        name: "Web Portal",
        slug: "web-portal",
        organizationId: "org_01KS2FV9E8DEMO1",
        organizationName: "Acme Corp",
        status: "RUNNING",
        cpu: 1000,
        memory: 2048,
        replicas: 2,
        suspended: true,
        framework: "Next.js",
        clusterName: "Production Cluster",
        clusterCode: "k8s-prod",
        gitopsCleanedUp: true,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "stack_2",
        name: "Worker Service",
        slug: "worker-svc",
        organizationId: "org_01KS2FV9E8DEMO2",
        organizationName: null,
        status: "IDLE",
        cpu: 500,
        memory: 512,
        replicas: 1,
        suspended: false,
        clusterName: "Staging Cluster",
        clusterCode: "k8s-stage",
        gitopsCleanedUp: true,
        createdAt: "2026-09-02T00:00:00.000Z",
      },
      {
        id: "stack_3",
        name: "Old App",
        slug: "old-app",
        organizationId: "org_01KS2FV9E8DEMO3",
        organizationName: "Legacy Inc",
        status: "TERMINATED",
        cpu: 2000,
        memory: 4096,
        replicas: 0,
        suspended: true,
        clusterName: null,
        clusterCode: null,
        gitopsCleanedUp: true,
        createdAt: "2026-09-03T00:00:00.000Z",
      },
    ],
  },
}))

const mockGetOrganizations = mock(async () => ({
  data: {
    ok: true,
    organizations: [
      { id: "org_01KS2FV9E8DEMO1", name: "Acme Corp" },
      { id: "org_01KS2FV9E8DEMO2", name: "Beta LLC" },
    ],
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        "app-hosting": {
          stacks: {
            get: mockGetStacks,
          },
        },
        organizations: {
          get: mockGetOrganizations,
        },
      },
    },
  },
}))

const {
  default: AdminStacksPage,
  formatCpu,
  formatMemory,
} = await import("./page-client")

describe("AdminStacksPage format helpers", () => {
  it("formats CPU accurately", () => {
    expect(formatCpu(null)).toBeNull()
    expect(formatCpu(0)).toBeNull()
    expect(formatCpu(500)).toBe("500m CPU")
    expect(formatCpu(1000)).toBe("1 vCPU")
    expect(formatCpu(1500)).toBe("1.5 vCPU")
    expect(formatCpu(2000)).toBe("2 vCPU")
  })

  it("formats memory accurately", () => {
    expect(formatMemory(null)).toBeNull()
    expect(formatMemory(0)).toBeNull()
    expect(formatMemory(512)).toBe("512 MB RAM")
    expect(formatMemory(1024)).toBe("1 GB RAM")
    expect(formatMemory(1536)).toBe("1.5 GB RAM")
    expect(formatMemory(2048)).toBe("2 GB RAM")
  })
})

describe("AdminStacksPage", () => {
  beforeEach(() => {
    mockLocale = "id"
    mockGetStacks.mockClear()
    mockGetOrganizations.mockClear()
    mockPush.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders page title, filter controls, and stack rows", async () => {
    const view = render(<AdminStacksPage />)

    expect(view.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Platform App Hosting"
    )

    // Filter controls
    expect(view.getByRole("combobox")).toBeInTheDocument()
    expect(view.getByPlaceholderText(/landing-web/i)).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: "Terapkan Filter" })
    ).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Reset" })).toBeInTheDocument()

    await waitFor(() => {
      expect(view.getByText("Web Portal")).toBeInTheDocument()
      expect(view.getByText("Worker Service")).toBeInTheDocument()
      expect(view.getByText("Old App")).toBeInTheDocument()
    })
  })

  it("renders CPU and RAM formatting correctly in the table", async () => {
    const view = render(<AdminStacksPage />)

    await waitFor(() => {
      expect(view.getByText("1 vCPU")).toBeInTheDocument()
      expect(view.getByText("2 GB RAM")).toBeInTheDocument()
      expect(view.getByText("500m CPU")).toBeInTheDocument()
      expect(view.getByText("512 MB RAM")).toBeInTheDocument()
    })
  })

  it("renders organization name as a link without displaying raw ID under the name", async () => {
    const view = render(<AdminStacksPage />)

    await waitFor(() => {
      const orgLink = view.getByRole("link", { name: "Acme Corp" })
      expect(orgLink).toBeInTheDocument()
      expect(orgLink).toHaveAttribute(
        "href",
        "/id/portal/admin/organizations/org_01KS2FV9E8DEMO1"
      )

      // Raw ID org_01KS2FV9E8DEMO1 should not appear in document
      expect(view.queryByText("org_01KS2FV9E8DEMO1")).not.toBeInTheDocument()

      // For stack_2 without organizationName, raw ID is displayed as fallback
      expect(view.getByText("org_01KS2FV9E8DEMO2")).toBeInTheDocument()
    })
  })

  it("does not render SUSPENDED label for TERMINATED stacks", async () => {
    const view = render(<AdminStacksPage />)

    await waitFor(() => {
      // Running suspended stack renders the suspended label
      const suspendedBadges = view.getAllByText("SUSPENDED (di-scale ke 0)")
      expect(suspendedBadges).toHaveLength(1)
    })
  })

  it("renders in English locale with appropriate labels and links", async () => {
    mockLocale = "en"
    const view = render(<AdminStacksPage />)

    expect(view.getByRole("heading", { level: 1 })).toHaveTextContent(
      "App Hosting Platforms"
    )
    expect(
      view.getByRole("button", { name: "Apply Filters" })
    ).toBeInTheDocument()

    await waitFor(() => {
      const orgLink = view.getByRole("link", { name: "Acme Corp" })
      expect(orgLink).toHaveAttribute(
        "href",
        "/en/portal/admin/organizations/org_01KS2FV9E8DEMO1"
      )
      const suspendedBadges = view.getAllByText("SUSPENDED (scaled to 0)")
      expect(suspendedBadges).toHaveLength(1)
    })
  })
})
