import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { render, screen } from "@testing-library/react"

const mockPush = mock(() => {})
mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
}))

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
        templates: {
          get: mock(async () => ({
            data: [
              {
                id: "tmpl-1",
                name: "n8n",
                slug: "n8n",
                version: "1.0.0",
                category: "AUTOMATION",
                visibility: "PUBLIC",
                isOfficial: true,
                isFeatured: true,
                blueprintJson: {
                  schemaVersion: "1.0.0",
                  image: "n8nio/n8n:latest",
                  resources: { defaultCpu: 500, defaultMemory: 512 },
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          })),
        },
      },
    },
  },
}))

import PortalAppTemplatesPage from "./page"

describe("PortalAppTemplatesPage", () => {
  it("renders the marketplace moderation view", async () => {
    render(<PortalAppTemplatesPage />)
    expect(
      screen.getByText("Marketplace Moderation & Governance")
    ).toBeInTheDocument()
    expect(screen.getByText("Official Templates")).toBeInTheDocument()
  })
})
