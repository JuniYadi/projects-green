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
    daily: mock(async () => ({
      ok: true,
      counts: [],
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

mock.module("@/modules/whatsapp/onboarding/use-whatsapp-onboarding", () => ({
  useWhatsAppOnboarding: () => ({
    isFeatureLocked: () => false,
    isGraduated: true,
    level: 3,
    progressPercent: 100,
    missions: [],
    activeMission: {
      title: "Done",
      subtitle: "Done",
      description: "Done",
      actionLabel: "Done",
      completed: true,
    },
    graduateNow: () => {},
    resetOnboarding: () => {},
  }),
}))

import WhatsAppDashboardPage from "./page"

describe("WhatsAppDashboardPage", () => {
  beforeEach(() => {
    mockMessages.devices.list.mockResolvedValue({
      ok: true,
      devices: [
        { id: "dev-1", phoneNumber: "+6281234567890", status: "ACTIVE" },
      ],
    })
    mockMessages.usage.overview.mockResolvedValue({
      ok: true,
      month: [
        {
          year: 2026,
          month: 8,
          messageInboxCount: 5,
          messageOutboxCount: 20,
        },
      ],
      cost: {
        totalAmount: 1500,
        totalEntries: 25,
        byCategory: [
          { category: "MARKETING", count: 15, totalCost: 1000 },
          { category: "UTILITY", count: 10, totalCost: 500 },
        ],
      },
    })
    mockMessages.usage.daily.mockResolvedValue({
      ok: true,
      counts: [
        { date: "2026-08-28", messageInboxCount: 2, messageOutboxCount: 8 },
        { date: "2026-08-29", messageInboxCount: 3, messageOutboxCount: 12 },
      ],
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
    mockMessages.devices.list.mockResolvedValueOnce({ ok: true, devices: [] })
    const view = render(<WhatsAppDashboardPage />)

    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "WhatsApp Dashboard" })
      ).toBeInTheDocument()
    })

    expect(
      view.getByRole("button", { name: /subscribe plan/i })
    ).toBeInTheDocument()

    expect(
      view.getByText("Activate your WhatsApp Business Account")
    ).toBeInTheDocument()

    expect(
      view.getByRole("button", { name: /hubungkan whatsapp sekarang/i })
    ).toBeInTheDocument()
  })

  it("renders visual donut category breakdown and 7-day trend card", async () => {
    const view = render(<WhatsAppDashboardPage />)

    await waitFor(() => {
      expect(
        view.getByText(/Komposisi Kategori Pesan|Category Breakdown/i)
      ).toBeInTheDocument()
      expect(
        view.getByText(/Tren Trafik 7 Hari|7-Day Traffic Trend/i)
      ).toBeInTheDocument()
    })
  })
})
