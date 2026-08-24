import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor, within } from "@testing-library/react"
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
    name: "Green Support",
    about: "Loaded profile about text",
    profile_picture_url: "https://example.com/profile.png",
    description: "Official support channel for Green platform",
    email: "support@green.local",
    address: "123 Green Way",
    websites: ["https://example.com"],
    vertical: "OTHER",
  },
} as const

mock.module("next/navigation", () => ({
  useParams: () => ({
    deviceId: "cmqoeiclj0006x94c6ofe0wti",
    lang: "en",
  }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: mock(() => {}),
    push: mock(() => {}),
  }),
}))

const mockUpdateProfile = mock(() =>
  Promise.resolve({
    ok: true,
    profile: {
      name: "Green Support",
      about: "Saved profile about text",
      websites: ["https://example.com"],
      vertical: "OTHER",
    },
  })
)

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    devices: {
      get: mock(() => Promise.resolve({ ok: true, device })),
      profile: {
        update: mockUpdateProfile,
      },
    },
    usage: {
      overview: mock(() =>
        Promise.resolve({
          ok: true,
          month: [],
          today: [],
          cost: { totalAmount: 0, totalEntries: 0, byCategory: [] },
          devices: [
            {
              deviceId: "cmqoeiclj0006x94c6ofe0wti",
              phoneNumber: "+6281212345678",
              messageInboxCount: 5,
              messageOutboxCount: 10,
              sessionCount: 2,
              messageFailedCount: 0,
            },
          ],
        })
      ),
    },
  },
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: () => ({
    console: {
      whatsapp: {
        devices: {
          heading: "WhatsApp Devices",
          description: "Connected WhatsApp devices",
          cardTitle: "Devices",
          cardDescription: "Manage your WhatsApp devices",
          active: "Active",
          inactive: "Inactive",
          edit: "Edit",
          editDialogTitle: "Edit Profile",
          editDialogDescription: "Update device profile",
          phoneNumber: "Phone Number",
          phoneNumberRequired: "Phone number is required",
          updated: "Updated",
          unableToUpdate: "Unable to update",
          noDevices: "No devices",
          noDevicesDescription: "No devices available",
          unableToLoad: "Unable to load",
          cancel: "Cancel",
          saving: "Saving...",
          saveChanges: "Save",
          invalidFileType: "Invalid file type",
          fileTooLarge: "File too large",
        },
      },
    },
  }),
}))

const mockFetch = mock((input: string | URL | Request, init?: RequestInit) => {
  const url =
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url
  const pathname = new URL(url, "http://localhost:3300").pathname

  if (pathname === "/api/whatsapp/devices/cmqoeiclj0006x94c6ofe0wti") {
    return Promise.resolve(jsonResponse({ ok: true, device }))
  }

  if (
    pathname === "/api/whatsapp/devices/cmqoeiclj0006x94c6ofe0wti/profile" &&
    init?.method === "PATCH"
  ) {
    return Promise.resolve(
      jsonResponse({
        ok: true,
        profile: {
          name: "Green Support",
          about: "Saved profile about text",
          websites: ["https://example.com"],
          vertical: "OTHER",
        },
      })
    )
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
      const preview = view.getByTestId("whatsapp-profile-preview")
      expect(within(preview).getByText("Green Support")).toBeTruthy()
      expect(
        within(preview).getByText("Loaded profile about text")
      ).toBeTruthy()
    })

    expect(
      within(view.getByTestId("whatsapp-profile-preview")).getByText("GS")
    ).toBeTruthy()
  })

  it("offers an image picker and preview instead of a profile URL field", async () => {
    const { default: ConsoleWhatsAppDeviceDetailPage } = await import("./page")

    const view = render(React.createElement(ConsoleWhatsAppDeviceDetailPage))
    await waitFor(() => {
      expect(view.getByTestId("whatsapp-profile-preview")).toBeTruthy()
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

  it("updates the preview from the saved profile response", async () => {
    const { default: ConsoleWhatsAppDeviceDetailPage } = await import("./page")

    const view = render(React.createElement(ConsoleWhatsAppDeviceDetailPage))

    await waitFor(() => {
      expect(view.getByTestId("whatsapp-profile-preview")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Edit WhatsApp Profile" }))
    fireEvent.change(await view.findByLabelText("About"), {
      target: { value: "Edited profile about text" },
    })
    fireEvent.click(view.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      const preview = view.getByTestId("whatsapp-profile-preview")
      expect(within(preview).getByText("Saved profile about text")).toBeTruthy()
    })
  })
})
