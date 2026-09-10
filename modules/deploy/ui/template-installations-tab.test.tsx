import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TemplateInstallationsTab } from "./template-installations-tab"

const mockInstallationsData = {
  template: {
    id: "tmpl-9router",
    slug: "9router",
    name: "9router Gateway",
    targetDeploymentType: "statefulset",
  },
  totalInstallations: 2,
  alignedInstallations: 1,
  outdatedInstallations: 1,
  installations: [
    {
      id: "stack-1",
      name: "9router Gateway Prod",
      slug: "9router-daring-pulsar",
      organizationId: "org-1",
      status: "READY",
      currentDeploymentType: "deployment",
      targetDeploymentType: "statefulset",
      isAligned: false,
      lastDeployedAt: "2026-09-01T10:00:00Z",
      lastDeployStatus: "READY",
      createdAt: "2026-09-01T10:00:00Z",
      latestDeployment: null,
    },
    {
      id: "stack-2",
      name: "9router-aligned",
      slug: "9router-aligned",
      organizationId: "org-2",
      status: "READY",
      currentDeploymentType: "statefulset",
      targetDeploymentType: "statefulset",
      isAligned: true,
      lastDeployedAt: "2026-09-02T10:00:00Z",
      lastDeployStatus: "READY",
      createdAt: "2026-09-02T10:00:00Z",
      latestDeployment: null,
    },
  ],
}

describe("TemplateInstallationsTab", () => {
  beforeEach(() => {
    cleanup()
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/installations")) {
        return new Response(JSON.stringify(mockInstallationsData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (urlStr.includes("/sync")) {
        return new Response(
          JSON.stringify({ total: 1, succeeded: 1, failed: 0, results: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Not found", { status: 404 })
    }) as unknown as typeof fetch
  })

  it("fetches and displays installation metrics and stack records", async () => {
    const { getByText } = render(
      <TemplateInstallationsTab
        templateId="tmpl-9router"
        templateName="9router Gateway"
        targetDeploymentType="statefulset"
      />
    )

    await waitFor(() => {
      expect(getByText("9router Gateway Prod")).toBeTruthy()
    })

    // KPI cards
    expect(getByText("Total Active Installations")).toBeTruthy()
    expect(getByText(/Aligned Workloads/i)).toBeTruthy()
    expect(getByText(/Outdated Workloads/i)).toBeTruthy()
  })

  it("opens confirmation dialog with safe merge explanation when Sync is clicked", async () => {
    const user = userEvent.setup()

    const { getByText, getAllByRole } = render(
      <TemplateInstallationsTab
        templateId="tmpl-9router"
        templateName="9router Gateway"
        targetDeploymentType="statefulset"
      />
    )

    await waitFor(() => {
      expect(getByText("9router Gateway Prod")).toBeTruthy()
    })

    // Click Sync button on first row
    const syncButtons = getAllByRole("button", { name: /sync/i })
    await user.click(syncButtons[0])

    await waitFor(() => {
      expect(getByText("Sync Application Setup from Template?")).toBeTruthy()
      expect(getByText(/Safe Merge Rules:/i)).toBeTruthy()
      expect(getByText(/Confirm & Trigger Sync/i)).toBeTruthy()
    })
  })
})
