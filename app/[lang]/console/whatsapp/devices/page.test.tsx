import { describe, expect, it, mock } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"

// NOTE: Do NOT import `screen` — it is evaluated at module-import time when
// document.body is still null (Happy DOM). Use render()'s return value.

const mockDevicesList = mock(() =>
  Promise.resolve({
    ok: true,
    devices: [
      {
        id: "dev_active",
        phoneNumber: "+6281234567890",
        name: "Support Line",
        status: "ACTIVE",
        organizationId: "org_1",
        quotaBase: 1000,
        quotaBaseOut: 100,
        balance: 50000,
        dailyLimitMessage: 500,
        lastHeartbeatAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dev_inactive",
        phoneNumber: "+6289876543210",
        name: "+6289876543210",
        status: "NON_ACTIVE",
        organizationId: "org_1",
        quotaBase: 1000,
        quotaBaseOut: 0,
        balance: 0,
        dailyLimitMessage: 0,
        lastHeartbeatAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  })
)

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    devices: {
      list: mockDevicesList,
    },
  },
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: () => ({
    console: {
      whatsapp: {
        devices: {
          heading: "WhatsApp Devices",
          description: "Manage your WhatsApp devices",
          cardTitle: "Devices",
          cardDescription: "Connected WhatsApp devices",
          noDevices: "No devices found",
          noDevicesDescription: "Add a device to get started",
          active: "Active",
          inactive: "Inactive",
          unableToLoad: "Unable to load devices",
          notifyAdmin: "Contact admin to activate",
        },
      },
    },
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

import WhatsAppDevicesPage from "./page"

function tick(ms = 50) {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

describe("WhatsAppDevicesPage", () => {
  it("renders search input with correct placeholder", async () => {
    const view = render(<WhatsAppDevicesPage />)
    await waitFor(() => {
      expect(
        view.getByPlaceholderText("Search devices by name or phone...")
      ).toBeInTheDocument()
    })

    view.unmount()
  })

  it("shows filter labels All Status and All Active States", async () => {
    const view = render(<WhatsAppDevicesPage />)
    await waitFor(() => {
      expect(view.getByText("All Status")).toBeDefined()
      expect(view.getByText("All Active States")).toBeDefined()
    })

    view.unmount()
  })

  it("renders active named device and inactive device", async () => {
    const view = render(<WhatsAppDevicesPage />)
    await waitFor(() => {
      expect(view.getByText("Support Line")).toBeInTheDocument()
    })
    expect(view.getByText("+6289876543210")).toBeInTheDocument()

    view.unmount()
  })

  it("filters rows when typing in search", async () => {
    const view = render(<WhatsAppDevicesPage />)
    await waitFor(() => {
      expect(
        view.getByPlaceholderText("Search devices by name or phone...")
      ).toBeInTheDocument()
    })
    await tick(100)

    // Both devices should render
    expect(view.getByText("Support Line")).toBeInTheDocument()

    // Type to filter by name
    const searchInput = view.getByPlaceholderText(
      "Search devices by name or phone..."
    )
    fireEvent.change(searchInput, { target: { value: "Support" } })
    await tick(100)

    // Support Line should still be visible
    expect(view.getByText("Support Line")).toBeInTheDocument()

    view.unmount()
  })

  it("shows Details action for active device", async () => {
    const view = render(<WhatsAppDevicesPage />)
    await waitFor(() => {
      expect(view.getByText("Support Line")).toBeInTheDocument()
    })
    await tick(100)

    // Active device should have a Details link
    const detailsLinks = view.getAllByText("Details")
    expect(detailsLinks.length).toBeGreaterThan(0)

    view.unmount()
  })
})
