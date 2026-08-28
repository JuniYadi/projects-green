import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { render, screen } from "@testing-library/react"

const mockPush = mock(() => {})
mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
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
