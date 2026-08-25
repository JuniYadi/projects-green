import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

const mockPush = mock(() => {})
const mockReloadTemplates = mock(async () => {})
const mockUseTemplates = mock(() => templateState)

let templateState = {
  templates: [] as Array<Record<string, unknown>>,
  loading: false,
  error: null as string | null,
  reload: mockReloadTemplates,
}

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush }),
}))

mock.module("sonner", () => ({
  toast: { error: mock(() => {}), success: mock(() => {}) },
}))

mock.module("@/modules/whatsapp/whatsapp-client", () => ({
  whatsappClient: {
    listDevices: mock(async () => [
      { id: "device-1", phoneNumber: "+628111", status: "ACTIVE" },
      { id: "device-2", phoneNumber: "+628222", status: "ACTIVE" },
    ]),
    listContacts: mock(async () => []),
    previewBroadcastSchedule: mock(() => new Promise<never>(() => {})),
    createBroadcast: mock(async () => ({ id: "broadcast-1" })),
  },
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: mockUseTemplates,
}))

import NewWhatsAppBroadcastPage from "./page"

const approvedTemplate = {
  id: "template-1",
  name: "Order ready",
  slug: "order_ready",
  organizationId: "org-1",
  syncStatus: "SYNCED",
  metaStatus: "APPROVED",
  languages: [
    { id: "language-en", lang: "en", isApproved: true, body: "Hello" },
    { id: "language-id", lang: "id", isApproved: true, body: "Halo" },
    { id: "language-fr", lang: "fr", isApproved: false, body: "Bonjour" },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const followUpTemplate = {
  ...approvedTemplate,
  id: "template-2",
  name: "Shipping update",
  slug: "shipping_update",
  languages: [
    { id: "language-en-2", lang: "en", isApproved: true, body: "Shipped" },
  ],
}

async function selectOption(
  view: ReturnType<typeof render>,
  label: string,
  option: string
) {
  fireEvent.click(view.getByRole("combobox", { name: label }))
  fireEvent.click(await view.findByRole("option", { name: option }))
}

describe("NewWhatsAppBroadcastPage selection flow", () => {
  afterEach(cleanup)

  beforeEach(() => {
    templateState = {
      templates: [approvedTemplate, followUpTemplate],
      loading: false,
      error: null,
      reload: mockReloadTemplates,
    }
    mockUseTemplates.mockClear()
    mockReloadTemplates.mockClear()
  })

  it("requires device selection before loading an approved template and language", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)
    const controls = view.getAllByRole("combobox")

    expect(controls.map((control) => control.getAttribute("id"))).toEqual([
      "device",
      "template",
      "language",
    ])
    expect(view.getByRole("combobox", { name: "Template" })).toBeDisabled()

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await waitFor(() => {
      expect(mockUseTemplates).toHaveBeenLastCalledWith({
        broadcastEligible: true,
        enabled: true,
        sort: "desc",
        whatsappDeviceId: "device-1",
      })
    })

    await selectOption(view, "Template", "Order ready")
    expect(view.getByRole("combobox", { name: "Bahasa" })).toBeEnabled()
    fireEvent.click(view.getByRole("combobox", { name: "Bahasa" }))
    expect(await view.findByRole("option", { name: "en" })).toBeInTheDocument()
    expect(view.getByRole("option", { name: "id" })).toBeInTheDocument()
    expect(view.queryByRole("option", { name: "fr" })).not.toBeInTheDocument()
    fireEvent.click(view.getByRole("option", { name: "id" }))
    await selectOption(view, "Template", "Shipping update")
    expect(view.getByRole("combobox", { name: "Bahasa" })).toHaveTextContent(
      "Pilih bahasa"
    )
  })

  it("shows an empty state when the selected device has no eligible templates", async () => {
    templateState.templates = []
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")

    expect(
      await view.findByText("Tidak ada template disetujui untuk perangkat ini.")
    ).toBeInTheDocument()
  })

  it("shows a retryable template loading error", async () => {
    templateState.error = "Unable to load templates"
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    expect(
      await view.findByText("Unable to load templates")
    ).toBeInTheDocument()
    fireEvent.click(view.getByRole("button", { name: "Coba lagi" }))
    expect(mockReloadTemplates).toHaveBeenCalledTimes(1)
  })

  it("clears the template and language when the device changes", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Order ready")
    await selectOption(view, "Bahasa", "id")
    await selectOption(view, "Perangkat WhatsApp", "+628222")

    expect(view.getByRole("combobox", { name: "Template" })).toHaveTextContent(
      "Pilih template"
    )
    expect(view.getByRole("combobox", { name: "Bahasa" })).toHaveTextContent(
      "Pilih bahasa"
    )
  })

  it("omits the variable step for a zero-variable template", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Order ready")
    await selectOption(view, "Bahasa", "id")

    expect(view.queryByText("3. Variabel Pesan")).not.toBeInTheDocument()
    expect(
      view.getByText("3. Preflight & Jadwal Pengiriman")
    ).toBeInTheDocument()
  })
})
