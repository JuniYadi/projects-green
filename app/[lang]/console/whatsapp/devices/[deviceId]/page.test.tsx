import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import React from "react"

const ORIGINAL_FETCH = globalThis.fetch

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const device = {
  id: "cmqoeiclj0006x94c6ofe0wti",
  organizationId: "org_1",
  phoneNumber: "+6281212345678",
  name: "Primary",
  status: "ACTIVE" as const,
  environment: "LIVE" as const,
  balance: 0,
  quotaBase: 1000,
  quotaBaseOut: 12,
  dailyLimitMessage: 0,
  whatsappBusinessAccountId: null,
  whatsappPhoneId: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  businessId: null,
  callbackUrl: null,
  expiredAt: null,
  features: null,
  whatsappProfile: {
    about: "Loaded profile about text",
    profile_picture_url: "https://example.com/profile.png",
    websites: ["https://example.com"],
    vertical: "OTHER",
  },
} as const

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", deviceId: "cmqoeiclj0006x94c6ofe0wti" }),
  useRouter: () => ({ push: mock(() => {}), replace: mock(() => {}) }),
  usePathname: () => "/en/console/whatsapp/devices/cmqoeiclj0006x94c6ofe0wti",
  useSearchParams: () => new URLSearchParams(),
}))

const mockFetch = mock((input: string | URL | Request) => {
  const url =
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url
  const pathname = new URL(url, "http://localhost:3300").pathname

  if (pathname === "/api/whatsapp/devices/cmqoeiclj0006x94c6ofe0wti") {
    return Promise.resolve(jsonResponse({ ok: true, device }))
  }

  if (pathname === "/api/whatsapp/templates") {
    return Promise.resolve(
      jsonResponse({
        ok: true,
        data: [],
        meta: { total: 0, page: 1, limit: 1, totalPages: 0 },
      })
    )
  }

  return Promise.resolve(jsonResponse({ ok: true }))
})

describe("ConsoleWhatsAppDeviceDetailPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
  })

  it("loads device profile after the loading render without changing hook order", async () => {
    const { default: ConsoleWhatsAppDeviceDetailPage } = await import("./page")

    const view = render(React.createElement(ConsoleWhatsAppDeviceDetailPage))

    await waitFor(() => {
      expect(view.getByText("Loaded profile about text")).toBeTruthy()
    })

    const calls = mockFetch.mock.calls
    const deviceCall = calls.find(([input]) => {
      const url =
        typeof input === "string" || input instanceof URL
          ? input.toString()
          : input.url
      return url.includes("/api/whatsapp/devices/cmqoeiclj0006x94c6ofe0wti")
    })
    expect(deviceCall).toBeTruthy()
    expect(view.getByText("Current WhatsApp profile picture")).toBeTruthy()
  })

  it("offers an image picker and preview instead of a profile URL field", async () => {
    const { default: ConsoleWhatsAppDeviceDetailPage } = await import("./page")

    const view = render(React.createElement(ConsoleWhatsAppDeviceDetailPage))
    await waitFor(() => {
      expect(view.getByText("Loaded profile about text")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Edit WhatsApp Profile" }))

    const fileInput = view.getByLabelText("Profile picture")
    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png")
    expect(view.queryByLabelText("Profile Picture URL")).toBeNull()

    fireEvent.change(fileInput, {
      target: {
        files: [
          new File([new Uint8Array([1, 2, 3])], "new-profile.png", {
            type: "image/png",
          }),
        ],
      },
    })

    expect(view.getByText("new-profile.png")).toBeTruthy()
  })
})
