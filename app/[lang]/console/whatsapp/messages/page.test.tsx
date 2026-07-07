import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, fireEvent } from "@testing-library/react"
import * as React from "react"

// ─── Mock functions (must be declared before mock.module) ───────────────────

const mockSendTemplate = mock(() =>
  Promise.resolve({ ok: true, messageId: "msg_123", status: "queued" })
)
const mockConversationsList = mock(() =>
  Promise.resolve({ ok: true, conversations: [] })
)
const mockDevicesList = mock(() =>
  Promise.resolve({
    ok: true,
    devices: [
      {
        id: "device_1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        name: "Test Device",
        organizationId: "org_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  })
)
const mockTemplatesData: Array<{
  id: string
  name: string
  slug: string
  metaStatus: string | null
  syncStatus: string
  languages: Array<{
    lang: string
    body: string | null
    isApproved?: boolean
    metaStatus?: string
  }>
  organizationId: string
  createdAt: string
  updatedAt: string
}> = [
  {
    id: "tpl_1",
    name: "hello_world",
    slug: "hello_world",
    metaStatus: "APPROVED",
    syncStatus: "SYNCED",
    languages: [
      {
        lang: "en",
        body: "Hello {{1}}, you have {{2}} new messages.",
        isApproved: true,
        metaStatus: "APPROVED",
      },
    ],
    organizationId: "org_1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ─── Module mocks ──────────────────────────────────────────────────────────

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    messages: {
      sendTemplate: mockSendTemplate,
      send: mock(() => Promise.resolve({ ok: true })),
      sendInteractive: mock(() => Promise.resolve({ ok: true })),
      list: mock(() => Promise.resolve({ ok: true, messages: [] })),
    },
    conversations: {
      list: mockConversationsList,
      get: mock(() =>
        Promise.resolve({
          ok: true,
          conversation: { whatsappMessages: [] },
        })
      ),
    },
    devices: {
      list: mockDevicesList,
    },
    webhooks: {
      stats: mock(() => Promise.resolve({ ok: true, data: null })),
    },
    broadcasts: {
      summary: mock(() => Promise.resolve({ total: 0 })),
    },
    usage: {
      overview: mock(() =>
        Promise.resolve({ ok: true, month: [], today: [], cost: null })
      ),
    },
  },
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: () => ({
    templates: mockTemplatesData,
    loading: false,
    error: null,
    reload: mock(() => Promise.resolve()),
  }),
}))

mock.module("@/modules/whatsapp/messages/ui/message-status-badge", () => ({
  MessageStatusBadge: () => null,
}))

// ─── Import page after mocks ───────────────────────────────────────────────

import WhatsAppMessagesPage from "./page"

function tick(ms = 50) {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

describe("WhatsAppMessagesPage", () => {
  beforeEach(() => {
    mockSendTemplate.mockClear()
  })

  it("renders the page with a New Message button", async () => {
    const view = render(<WhatsAppMessagesPage />)

    expect(view.getByText("Messages")).toBeInTheDocument()
    expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument()
    expect(view.queryByText("Message *")).not.toBeInTheDocument()
    expect(view.queryByText(/interactive message/i)).not.toBeInTheDocument()
    expect(view.queryByText(/reply buttons/i)).not.toBeInTheDocument()
    expect(view.queryByText(/cta url/i)).not.toBeInTheDocument()

    view.unmount()
  })

  it("opens send dialog and shows 2-column layout with single-device auto-selection", async () => {
    const view = render(<WhatsAppMessagesPage />)

    // Wait for devices to load and auto-select to complete
    await waitFor(() => {
      expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled()
    })
    await tick(50)

    // Click New Message to open dialog
    fireEvent.click(view.getByRole("button", { name: /new message/i }))

    // Dialog title should appear
    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "Send Template Message" })
      ).toBeInTheDocument()
    })

    // Phone Number field rendered at top of left column
    expect(view.getByText("Phone Number *")).toBeInTheDocument()

    // Device * NOT rendered — single active device auto-selected
    expect(view.queryByText("Device *")).not.toBeInTheDocument()
    expect(view.getByText("+6281234567890")).toBeInTheDocument()

    // Template * rendered after Phone Number in DOM order
    expect(view.getByText("Template *")).toBeInTheDocument()
    const phoneLabel = view.getByText("Phone Number *")
    const templateLabel = view.getByText("Template *")
    expect(phoneLabel.compareDocumentPosition(templateLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    // Preview heading renders
    expect(view.getByText("Message Preview")).toBeInTheDocument()

    // Fill phone and select template
    const phoneInput = view.getByPlaceholderText("+628123456789")
    fireEvent.change(phoneInput, { target: { value: "+6289876543210" } })
    const templateButtons = view.getAllByText("hello_world")
    fireEvent.click(templateButtons[0])

    // Send button is enabled
    const sendButton = view.getByRole("button", { name: /send template message/i })
    expect(sendButton).not.toBeDisabled()

    view.unmount()
  })
  it("shows send button enabled after filling all fields", async () => {
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() => {
      expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled()
    })
    await tick(100)

    // Open dialog
    fireEvent.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "Send Template Message" })
      ).toBeInTheDocument()
    })

    // Fill phone
    const phoneInput = view.getByPlaceholderText("+628123456789")
    fireEvent.change(phoneInput, { target: { value: "+6289876543210" } })

    // Select template (works inside dialog)
    fireEvent.click(view.getAllByText("hello_world")[0])

    // Wait for placeholder fields to appear
    await waitFor(() => {
      expect(view.queryByPlaceholderText("Value for {{1}}")).toBeInTheDocument()
    })

    // Fill placeholder fields
    fireEvent.change(view.getByPlaceholderText("Value for {{1}}"), { target: { value: "John" } })
    fireEvent.change(view.getByPlaceholderText("Value for {{2}}"), { target: { value: "Acme Corp" } })
    await tick(100)

    // Verify button state
    const sendButton = view.getByRole("button", { name: /send template message/i })
    expect(sendButton).not.toBeDisabled()

    view.unmount()
  })

  it("does not render old free-form message fields", async () => {
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() => {
      expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument()
    })

    expect(view.queryByText("Message *")).not.toBeInTheDocument()
    expect(view.queryByText(/interactive message/i)).not.toBeInTheDocument()
    expect(view.queryByText(/reply buttons/i)).not.toBeInTheDocument()
    expect(view.queryByText(/cta url/i)).not.toBeInTheDocument()

    view.unmount()
  })
})
