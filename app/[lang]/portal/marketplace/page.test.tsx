import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminTemplateRecord } from "./_components/template-inspector-drawer"

const mockTemplates: AdminTemplateRecord[] = [
  {
    id: "tpl-pending-1",
    slug: "custom-ghost",
    name: "Custom Ghost",
    tagline: "Modern publishing platform",
    description: "Ghost blog description with details",
    category: "CMS",
    visibility: "PENDING_REVIEW",
    version: "1.0.0",
    isOfficial: false,
    isFeatured: false,
    installCount: 0,
    blueprintJson: {
      version: "1.0.0",
      runtime: {
        image: "ghost:5-alpine",
        defaultPort: 2368,
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 512,
      },
      dependencies: [
        {
          serviceType: "MYSQL",
          alias: "ghost_db",
          envPrefix: "database__",
        },
      ],
      envSchema: [
        {
          key: "NODE_ENV",
          label: "Environment",
          dataType: "string",
          defaultValue: "production",
          required: true,
        },
      ],
    },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "tpl-live-1",
    slug: "directus",
    name: "Directus",
    tagline: "Open-source data platform",
    description: "Instant REST and GraphQL API",
    category: "DEVELOPER_TOOLS",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: false,
    isFeatured: true,
    installCount: 15,
    blueprintJson: {
      version: "1.0.0",
      runtime: {
        image: "directus/directus:latest",
        defaultPort: 8055,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 512,
      },
      dependencies: [],
      envSchema: [],
    },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "tpl-official-1",
    slug: "n8n",
    name: "n8n",
    tagline: "Workflow automation tool",
    description: "Official fair-code workflow platform",
    category: "AUTOMATION",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 50,
    blueprintJson: {
      version: "1.0.0",
      runtime: {
        image: "n8nio/n8n:latest",
        defaultPort: 5678,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 512,
      },
      dependencies: [],
      envSchema: [],
    },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
]

const mockApprove = mock(() =>
  Promise.resolve({ data: { visibility: "PUBLIC", verifiedAt: new Date() } })
)
const mockReject = mock(() =>
  Promise.resolve({
    data: { visibility: "REJECTED", reviewNotes: "Invalid port" },
  })
)
const mockToggleFeatured = mock(() =>
  Promise.resolve({ data: { isFeatured: true } })
)

mock.module("@/components/ui/phosphor-icons", () => ({
  ShieldCheckIcon: () => <span data-testid="icon-shield-check" />,
  Globe: () => <span data-testid="icon-globe" />,
  Clock: () => <span data-testid="icon-clock" />,
  EyeIcon: () => <span data-testid="icon-eye" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  XCircle: () => <span data-testid="icon-x-circle" />,
  Star: () => <span data-testid="icon-star" />,
  Cpu: () => <span data-testid="icon-cpu" />,
  Database: () => <span data-testid="icon-database" />,
  Lock: () => <span data-testid="icon-lock" />,
  Package: () => <span data-testid="icon-package" />,
  MagnifyingGlassIcon: () => <span data-testid="icon-search" />,
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        templates: Object.assign(
          mock(() => Promise.resolve({ data: mockTemplates })),
          {
            get: mock(() => Promise.resolve({ data: mockTemplates })),
            "tpl-pending-1": {
              approve: { post: mockApprove },
              reject: { post: mockReject },
              "toggle-featured": { post: mockToggleFeatured },
            },
          }
        ),
      },
    },
  },
}))

const { default: PortalMarketplaceModerationPage } = await import("./page")

describe("PortalMarketplaceModerationPage", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders tabs and pending templates list by default", async () => {
    render(<PortalMarketplaceModerationPage />)

    expect(
      screen.getByText("Marketplace Moderation & Governance")
    ).toBeInTheDocument()
    expect(screen.getByText("Pending Review")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("Custom Ghost")).toBeInTheDocument()
    })
  })

  it("allows inspecting a pending template and opening drawer", async () => {
    const user = userEvent.setup()
    render(<PortalMarketplaceModerationPage />)

    await waitFor(() => {
      expect(screen.getByText("Custom Ghost")).toBeInTheDocument()
    })

    const inspectBtn = screen.getByRole("button", { name: /inspect/i })
    await user.click(inspectBtn)

    await waitFor(() => {
      expect(
        screen.getByText("Ghost blog description with details")
      ).toBeInTheDocument()
      expect(screen.getAllByText("ghost:5-alpine").length).toBeGreaterThan(0)
    })
  })

  it("allows approving a pending template directly or via drawer", async () => {
    const user = userEvent.setup()
    render(<PortalMarketplaceModerationPage />)

    await waitFor(() => {
      expect(screen.getByText("Custom Ghost")).toBeInTheDocument()
    })

    const approveBtn = screen.getByRole("button", { name: /approve/i })
    await user.click(approveBtn)

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalled()
    })
  })
})
