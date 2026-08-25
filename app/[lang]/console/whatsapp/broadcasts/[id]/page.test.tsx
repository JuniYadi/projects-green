import "@/test/register"
import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type {
  Broadcast,
  BroadcastRecipient,
} from "@/modules/whatsapp/whatsapp-client"

const makeRecipient = (
  overrides: Partial<BroadcastRecipient> & Pick<BroadcastRecipient, "id">
): BroadcastRecipient => ({
  phoneNumber: "+6281230000099",
  name: null,
  dynamicValues: null,
  status: "QUEUED",
  attempts: 0,
  waMessageId: null,
  lastError: null,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
  ...overrides,
})

const makeBroadcast = (
  overrides: Partial<Broadcast> & Pick<Broadcast, "id">
): Broadcast => ({
  organizationId: "org_1",
  templateName: "Promo Ramadhan",
  templateLanguage: "id",
  templateParams: null,
  throttleMaxMessages: null,
  throttlePerMinutes: null,
  status: "PROCESSING",
  total: 4,
  queued: 2,
  sent: 1,
  failed: 1,
  startedAt: "2026-08-20T00:00:00.000Z",
  endedAt: null,
  whatsappDeviceId: null,
  whatsappContactGroupId: null,
  recipients: [],
  recipientCount: 4,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
  ...overrides,
})

const failedRecipient = makeRecipient({
  id: "r1",
  phoneNumber: "+6281230000001",
  name: "Andi",
  status: "FAILED",
  attempts: 3,
  lastError: 'Template param "name", missing variable',
  updatedAt: "2026-08-20T01:00:00.000Z",
})

const sentRecipient = makeRecipient({
  id: "r2",
  phoneNumber: "+6281230000002",
  name: "Budi",
  status: "SENT",
  attempts: 1,
  waMessageId: "wamid.123",
})

const broadcastWithFailures = makeBroadcast({
  id: "bc_1",
  recipients: [
    failedRecipient,
    sentRecipient,
    makeRecipient({ id: "r3", phoneNumber: "+6281230000003" }),
    makeRecipient({ id: "r4", phoneNumber: "+6281230000004" }),
  ],
})

const broadcastWithoutFailures = makeBroadcast({
  id: "bc_2",
  status: "COMPLETED",
  total: 2,
  queued: 0,
  sent: 2,
  failed: 0,
  recipientCount: 2,
  recipients: [sentRecipient, makeRecipient({ id: "r5", status: "SENT" })],
})

const getBroadcast = mock(() => Promise.resolve(broadcastWithFailures))
let currentLocale = "en"

mock.module("next/navigation", () => ({
  useRouter: () => ({ back: mock(() => {}), push: mock(() => {}) }),
  useParams: () => ({ lang: currentLocale, id: "bc_1" }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string }) => `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang?: string) => lang || "en",
}))

mock.module("@/modules/whatsapp/whatsapp-client", () => ({
  whatsappClient: { getBroadcast },
}))

import WhatsAppBroadcastDetailPage from "./page"

const metricValue = (view: ReturnType<typeof render>, label: string) => {
  const cards = Array.from(document.querySelectorAll(".rounded-lg"))
  const card = cards.find((el) =>
    el.querySelector("p.text-sm")?.textContent?.trim().startsWith(label)
  )
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Metric card "${label}" not found`)
  }
  return card.querySelector('p[class*="text-2xl"]')?.textContent ?? ""
}

describe("WhatsAppBroadcastDetailPage", () => {
  const originalCreateObjectURL = globalThis.URL.createObjectURL
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL
  const originalCreateElement = document.createElement.bind(document)
  let objectUrls: string[]
  let exportedBlobs: Blob[]
  let anchors: HTMLAnchorElement[]

  beforeEach(() => {
    currentLocale = "en"
    document.body.innerHTML = ""
    getBroadcast.mockImplementation(() =>
      Promise.resolve(broadcastWithFailures)
    )
    objectUrls = []
    exportedBlobs = []
    anchors = []
    globalThis.URL.createObjectURL = mock((blob: Blob | File) => {
      exportedBlobs.push(blob)
      const url = `blob:${blob.size}-${objectUrls.length}`
      objectUrls.push(url)
      return url
    })
    globalThis.URL.revokeObjectURL = mock(() => {})
    document.createElement = ((tag: string) => {
      const element = originalCreateElement(tag)
      if (tag === "a") anchors.push(element as HTMLAnchorElement)
      return element
    }) as typeof document.createElement
  })

  afterEach(() => {
    globalThis.URL.createObjectURL = originalCreateObjectURL
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
    document.createElement = originalCreateElement
  })

  it("renders progress bar and four aggregate metric cards", async () => {
    const view = render(<WhatsAppBroadcastDetailPage />)

    await waitFor(() => {
      expect(view.getByText("Delivery progress")).toBeInTheDocument()
    })

    expect(metricValue(view, "Total recipients")).toBe("4")
    expect(metricValue(view, "Sent")).toBe("1")
    expect(metricValue(view, "Queued")).toBe("2")
    expect(metricValue(view, "Failed")).toBe("1")

    // (sent 1 + failed 1) / total 4 = 50%, label plus completion caption
    expect(view.getByText("50%")).toBeInTheDocument()
    expect(view.getByText(/50% complete/)).toBeInTheDocument()
    const fill = document.querySelector<HTMLElement>("[style*='width: 50%']")
    expect(fill).not.toBeNull()
    view.unmount()
  })

  it("exports only FAILED recipients as CSV with proper escaping", async () => {
    const user = userEvent.setup()
    const view = render(<WhatsAppBroadcastDetailPage />)

    const button = await waitFor(() =>
      view.getByRole("button", { name: /download failed numbers/i })
    )
    await user.click(button)

    expect(objectUrls.length).toBe(1)
    expect(anchors[0]?.download).toBe("failed-broadcast-bc_1.csv")

    const csv = await exportedBlobs[0].text()
    const lines = csv.split("\n")
    expect(lines[0]).toBe("phoneNumber,name,lastError,updatedAt")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe(
      '+6281230000001,Andi,"Template param ""name"", missing variable",2026-08-20T01:00:00.000Z'
    )

    view.unmount()
  })

  it("disables export while there are no failures", async () => {
    getBroadcast.mockImplementation(() =>
      Promise.resolve(broadcastWithoutFailures)
    )
    const view = render(<WhatsAppBroadcastDetailPage />)

    const button = await waitFor(() =>
      view.getByRole("button", { name: /download failed numbers/i })
    )
    expect(button).toHaveProperty("disabled", true)

    view.unmount()
  })

  it("filters recipients by status tab and search query", async () => {
    const user = userEvent.setup()
    const view = render(<WhatsAppBroadcastDetailPage />)

    await waitFor(() => {
      expect(view.getByText("+6281230000001")).toBeInTheDocument()
    })
    expect(view.getAllByRole("row")).toHaveLength(5) // header + 4 recipients

    await user.click(view.getByRole("tab", { name: "Queued" }))
    expect(view.getAllByRole("row")).toHaveLength(3) // header + 2 queued
    expect(view.queryByText("+6281230000001")).toBeNull()
    expect(view.getByText("+6281230000003")).toBeInTheDocument()

    await user.click(view.getByRole("tab", { name: "All" }))
    await user.type(
      view.getByPlaceholderText("Search name or phone number..."),
      "andi"
    )
    expect(view.getAllByRole("row")).toHaveLength(2) // header + Andi only
    expect(view.queryByText("+6281230000002")).toBeNull()

    view.unmount()
  })

  it("renders Indonesian customer-facing broadcast copy", async () => {
    currentLocale = "id"
    const view = render(<WhatsAppBroadcastDetailPage />)

    expect(await view.findByText("Progres pengiriman")).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: /unduh daftar nomor gagal/i })
    ).toBeInTheDocument()

    view.unmount()
  })
})
