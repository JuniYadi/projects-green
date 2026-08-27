import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PortalMarketplaceModerationPage from "./page"
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
          key: "url",
          label: "Site URL",
          required: true,
          isSecret: false,
          dataType: "string",
        },
      ],
    },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "tpl-live-1",
    slug: "community-n8n",
    name: "Community n8n",
    tagline: "Workflow automation tool",
    description: "n8n automation suite",
    category: "AUTOMATION",
    visibility: "PUBLIC",
    version: "1.2.0",
    isOfficial: false,
    isFeatured: false,
    installCount: 15,
    blueprintJson: {
      version: "1.0.0",
      runtime: {
        image: "n8nio/n8n:latest",
        defaultPort: 5678,
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 1024,
      },
      dependencies: [],
      envSchema: [],
    },
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "tpl-official-1",
    slug: "official-redis",
    name: "Official Redis",
    tagline: "High-performance key-value store",
    description: "Redis caching engine",
    category: "DATABASE",
    visibility: "PUBLIC",
    version: "7.2.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 120,
    blueprintJson: {
      version: "1.0.0",
      runtime: {
        image: "redis:7-alpine",
        defaultPort: 6379,
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 250,
        defaultMemory: 256,
      },
      dependencies: [],
      envSchema: [],
    },
    createdAt: "2026-01-03T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
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
describe("PortalMarketplaceModerationPage", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders tabs and pending templates list by default", async () => {
    render(<PortalMarketplaceModerationPage />)

    expect(screen.getByText("Marketplace Moderation & Governance")).toBeTruthy()
    expect(screen.getByText("Pending Review")).toBeTruthy()
    expect(screen.getByText("Live Marketplace")).toBeTruthy()
    expect(screen.getByText("Official Templates")).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText("Custom Ghost")).toBeTruthy()
    })
  })

  it("allows inspecting a pending template and opening drawer", async () => {
    const user = userEvent.setup()
    render(<PortalMarketplaceModerationPage />)

    await waitFor(() => {
      expect(screen.getByText("Custom Ghost")).toBeTruthy()
    })

    const inspectBtn = screen.getByRole("button", { name: /Inspect/i })
    await user.click(inspectBtn)

    await waitFor(() => {
      expect(screen.getAllByText("ghost:5-alpine").length).toBeGreaterThan(0)
      expect(screen.getByText("Required Database Stocks")).toBeTruthy()
      expect(screen.getByText("ghost_db")).toBeTruthy()
    })
  })

  it("allows approving a pending template directly or via drawer", async () => {
    const user = userEvent.setup()
    render(<PortalMarketplaceModerationPage />)

    await waitFor(() => {
      expect(screen.getByText("Custom Ghost")).toBeTruthy()
    })

    const approveBtn = screen.getByRole("button", { name: /Approve/i })
    await user.click(approveBtn)

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalled()
    })
  })
})
