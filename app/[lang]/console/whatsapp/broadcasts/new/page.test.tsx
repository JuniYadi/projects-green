import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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
  useParams: () => ({ lang: "id" }),
  useRouter: () => ({ push: mockPush }),
}))

mock.module("sonner", () => ({
  toast: { error: mock(() => {}), success: mock(() => {}) },
}))

let deviceState: Array<Record<string, unknown>> = [
  { id: "device-1", phoneNumber: "+628111", status: "ACTIVE" },
  { id: "device-2", phoneNumber: "+628222", status: "ACTIVE" },
]
let contactState: Array<Record<string, unknown>> = []

mock.module("@/modules/whatsapp/whatsapp-client", () => ({
  whatsappClient: {
    listDevices: mock(async () => deviceState),
    listContacts: mock(async () => contactState),
    previewBroadcastSchedule: mock(() => new Promise<never>(() => {})),
    preflightBroadcast: mock(async () => ({
      capacity: {
        dailyLimit: 1000,
        remainingToday: 1000,
        hourlyLimit: 100,
      },
      recommendation: null,
      selection: {
        deviceId: "device-1",
        templateId: "template-1",
        templateName: "Order ready",
        templateLanguage: "id",
        templateBody: null,
      },
      recipientCount: 0,
      dispatchMode: "MANUAL_DISPATCH" as const,
    })),
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
const personalizedTemplate = {
  ...approvedTemplate,
  id: "template-3",
  name: "Promo blast",
  slug: "promo_blast",
  languages: [
    {
      id: "language-promo-id",
      lang: "id",
      isApproved: true,
      body: "Halo {{1}}, diskon khusus untuk Anda: {{2}}",
    },
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
    deviceState = [
      { id: "device-1", phoneNumber: "+628111", status: "ACTIVE" },
      { id: "device-2", phoneNumber: "+628222", status: "ACTIVE" },
    ]
    contactState = []
    mockUseTemplates.mockClear()
    mockReloadTemplates.mockClear()
  })
  it("auto-selects the only active device", async () => {
    deviceState = [{ id: "device-1", phoneNumber: "+628111", status: "ACTIVE" }]
    const view = render(<NewWhatsAppBroadcastPage />)

    await waitFor(() => {
      expect(
        view.getByRole("combobox", { name: "Perangkat WhatsApp" })
      ).toHaveTextContent("+628111")
    })
  })

  it("does not auto-select when more than one active device exists", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)
    const trigger = view.getByRole("combobox", { name: "Perangkat WhatsApp" })

    await waitFor(() => {
      expect(trigger).toHaveTextContent("Pilih perangkat")
    })
    fireEvent.click(trigger)
    expect(
      await view.findByRole("option", { name: "+628111" })
    ).toBeInTheDocument()
    expect(view.getByRole("option", { name: "+628222" })).toBeInTheDocument()
  })
  it("filters the template dropdown by search text", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    fireEvent.change(view.getByPlaceholderText("Cari template..."), {
      target: { value: "Shipping" },
    })
    fireEvent.click(view.getByRole("combobox", { name: "Template" }))

    expect(
      await view.findByRole("option", { name: "Shipping update" })
    ).toBeInTheDocument()
    expect(
      view.queryByRole("option", { name: "Order ready" })
    ).not.toBeInTheDocument()
  })
  it("renders language options as flag pills instead of a dropdown", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Order ready")

    expect(
      view.queryByRole("combobox", { name: "Bahasa" })
    ).not.toBeInTheDocument()
    expect(
      await view.findByRole("radio", { name: /🇺🇸.*en/ })
    ).toBeInTheDocument()
    expect(view.getByRole("radio", { name: /🇮🇩.*id/ })).toBeInTheDocument()
    expect(view.queryByRole("radio", { name: /fr/ })).not.toBeInTheDocument()

    fireEvent.click(view.getByRole("radio", { name: /🇮🇩.*id/ }))
    expect(view.getByRole("radio", { name: /🇮🇩.*id/ })).toBeChecked()
  })

  it("requires device selection before loading an approved template and language", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)
    const controls = view.getAllByRole("combobox")

    expect(controls.map((control) => control.getAttribute("id"))).toEqual([
      "device",
      "template",
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
    expect(await view.findByRole("radio", { name: /en/ })).toBeInTheDocument()
    expect(view.getByRole("radio", { name: /id/ })).toBeInTheDocument()
    expect(view.queryByRole("radio", { name: /fr/ })).not.toBeInTheDocument()
    fireEvent.click(view.getByRole("radio", { name: /id/ }))
    expect(view.getByRole("radio", { name: /id/ })).toBeChecked()
    await selectOption(view, "Template", "Shipping update")
    expect(await view.findByRole("radio", { name: /en/ })).not.toBeChecked()
    expect(view.queryByRole("radio", { name: /id/ })).not.toBeInTheDocument()
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
    fireEvent.click(await view.findByRole("radio", { name: /id/ }))
    await selectOption(view, "Perangkat WhatsApp", "+628222")

    expect(view.getByRole("combobox", { name: "Template" })).toHaveTextContent(
      "Pilih template"
    )
    expect(view.queryByRole("radio")).not.toBeInTheDocument()
  })

  it("omits the variable step for a zero-variable template", async () => {
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Order ready")
    fireEvent.click(await view.findByRole("radio", { name: /id/ }))

    expect(view.queryByText("3. Variabel Pesan")).not.toBeInTheDocument()
    expect(
      view.getByText("4. Preflight & jadwal pengiriman")
    ).toBeInTheDocument()
  })

  it("renders a live preview that updates as default variable values are typed", async () => {
    templateState.templates = [personalizedTemplate]
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Promo blast")
    fireEvent.click(await view.findByRole("radio", { name: /id/ }))

    expect(
      await view.findByText(
        "Halo Example 1, diskon khusus untuk Anda: Example 2"
      )
    ).toBeInTheDocument()

    fireEvent.change(view.getByLabelText("Nilai untuk {{1}}"), {
      target: { value: "Budi" },
    })
    fireEvent.change(view.getByLabelText("Nilai untuk {{2}}"), {
      target: { value: "MERDEKA50" },
    })

    expect(
      await view.findByText("Halo Budi, diskon khusus untuk Anda: MERDEKA50")
    ).toBeInTheDocument()
  })

  it("steps through personalized recipients in the live preview", async () => {
    templateState.templates = [personalizedTemplate]
    contactState = [
      {
        id: "contact-1",
        name: "Budi Santoso",
        phoneNumber: "+628111111111",
        dynamicValues: { "{{1}}": "Budi Santoso", "{{2}}": "MERDEKA50" },
      },
      {
        id: "contact-2",
        name: "Siti Aminah",
        phoneNumber: "+628222222222",
        dynamicValues: { "{{1}}": "Siti Aminah", "{{2}}": "MERDEKA75" },
      },
    ]
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Promo blast")
    fireEvent.click(await view.findByRole("radio", { name: /id/ }))
    await userEvent.click(view.getByRole("tab", { name: "Daftar kontak" }))
    await userEvent.click(await view.findByText("Budi Santoso"))
    await userEvent.click(view.getByText("Siti Aminah"))

    expect(view.getByText("Menampilkan pratinjau 1 dari 2")).toBeInTheDocument()
    expect(
      await view.findByText(
        "Halo Budi Santoso, diskon khusus untuk Anda: MERDEKA50"
      )
    ).toBeInTheDocument()

    fireEvent.click(view.getByRole("button", { name: "Penerima berikutnya" }))

    expect(view.getByText("Menampilkan pratinjau 2 dari 2")).toBeInTheDocument()
    expect(
      await view.findByText(
        "Halo Siti Aminah, diskon khusus untuk Anda: MERDEKA75"
      )
    ).toBeInTheDocument()
  })

  it("hides the recipient stepper on the Manual Input tab", async () => {
    templateState.templates = [personalizedTemplate]
    const view = render(<NewWhatsAppBroadcastPage />)

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Promo blast")
    fireEvent.click(await view.findByRole("radio", { name: /id/ }))

    expect(
      view.queryByRole("button", { name: "Penerima berikutnya" })
    ).not.toBeInTheDocument()
    expect(
      view.getByText("Pratinjau diperbarui secara langsung saat Anda mengetik.")
    ).toBeInTheDocument()
  })

  it("offers the CSV template download from the Manual Input tab, disabled until a template and language are chosen", async () => {
    templateState.templates = [personalizedTemplate]
    const view = render(<NewWhatsAppBroadcastPage />)

    expect(
      view.getByRole("button", { name: "Unduh template CSV" })
    ).toBeDisabled()

    await selectOption(view, "Perangkat WhatsApp", "+628111")
    await selectOption(view, "Template", "Promo blast")
    fireEvent.click(await view.findByRole("radio", { name: /id/ }))

    expect(
      view.getByText(
        "Setiap nomor di atas akan menerima pesan yang sama persis. Butuh nama atau kode berbeda per nomor? Unduh template CSV di bawah ini dan gunakan tab Unggah CSV."
      )
    ).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: "Unduh template CSV" })
    ).toBeEnabled()
  })
})
