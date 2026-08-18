import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
const mockMessages = {
  devices: {
    list: mock(async () => ({ ok: true, devices: [] })),
  },
  conversations: {
    list: mock(async () => ({ ok: true, conversations: [] })),
  },
  webhooks: {
    stats: mock(async () => ({
      ok: true,
      data: {
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        totalEvents: 0,
        failedEvents: 0,
        deadLetters: 0,
        failureRate: 0,
      },
    })),
  },
  usage: {
    overview: mock(async () => ({
      ok: true,
      month: [],
    })),
  },
  broadcasts: {
    summary: mock(async () => ({
      ok: true,
      total: 0,
    })),
  },
}

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: mockMessages,
}))

import WhatsAppDashboardPage from "./page"

describe("WhatsAppDashboardPage", () => {
  beforeEach(() => {
    mockMessages.devices.list.mockResolvedValue({ ok: true, devices: [] })
    mockMessages.usage.overview.mockResolvedValue({
      ok: true,
      month: [],
    })
    mockMessages.conversations.list.mockResolvedValue({
      ok: true,
      conversations: [],
    })
  })

  afterEach(() => {
    mock.restore()
  })

  it("renders subscribe plan CTA in header and zero-devices activation card", async () => {
    const view = render(<WhatsAppDashboardPage />)

    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "WhatsApp Dashboard" })
      ).toBeInTheDocument()
    })

    expect(view.getByRole("link", { name: "Subscribe Plan" })).toHaveAttribute(
      "href",
      "/console/billing/services/whatsapp"
    )

    expect(
      view.getByText("Activate your WhatsApp Business Account")
    ).toBeInTheDocument()

    expect(
      view.getByRole("link", { name: "View Plans & Subscribe" })
    ).toHaveAttribute("href", "/console/billing/services/whatsapp")
  })
})
