import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"

// ─── Shared mock variables (must be before mock.module) ─────────────────────

const mockRouterPush = mock(() => {})
const mockRouterReplace = mock(() => {})
let mockSearchParams = new URLSearchParams()
const mockConversationsGet = mock(() => {
  const nullable = null as string | null
  return Promise.resolve({
    ok: true,
    conversation: {
      id: "conv_default", organizationId: "org_1", contactPhone: "+6280000000000",
      lastMessageAt: nullable, lastDirection: nullable, whatsappDeviceId: nullable,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      _count: { whatsappMessages: 0 },
      whatsappMessages: [] as Array<Record<string, unknown>>,
    },
  })
})

// ─── Mock functions ─────────────────────────────────────────────────────────

const mockSendTemplate = mock(() =>
  Promise.resolve({ ok: true, messageId: "msg_123", status: "queued" })
)
const mockConversationsList = mock(() =>
  Promise.resolve({ ok: true, conversations: [] as Array<{
    id: string; organizationId: string; contactPhone: string; lastMessageAt: string | null
    lastDirection: string | null; whatsappDeviceId: string | null; createdAt: string
    updatedAt: string; _count: { whatsappMessages: number }
  }> })
)
const mockDevicesList = mock(() =>
  Promise.resolve({
    ok: true,
    devices: [{
      id: "device_1", phoneNumber: "+6281234567890", status: "ACTIVE",
      name: "Test Device", organizationId: "org_1",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }],
  })
)
const mockTemplatesData: Array<{
  id: string; name: string; slug: string; metaStatus: string | null; syncStatus: string
  headerText?: string | null; headerType?: string | null; footer?: string | null
  buttons?: unknown; parameters?: unknown
  languages: Array<{
    lang: string; body: string | null; isApproved?: boolean; metaStatus?: string
    headerText?: string | null; headerType?: string | null; footer?: string | null
    buttons?: unknown; parameters?: unknown
  }>
  organizationId: string; createdAt: string; updatedAt: string
}> = [{
  id: "tpl_1", name: "hello_world", slug: "hello_world",
  metaStatus: "APPROVED", syncStatus: "SYNCED",
  languages: [{
    lang: "en", body: "Hello {{1}}, you have {{2}} new messages.",
    footer: "Reply STOP", buttons: [{ type: "QUICK_REPLY", text: "Yes" }],
    parameters: { components: [{ type: "BODY", example: { body_text: [["John", "5"]] } }] },
    isApproved: true, metaStatus: "APPROVED",
  }],
  organizationId: "org_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}]

// ─── Module mocks ──────────────────────────────────────────────────────────

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/en/console/whatsapp/messages",
  useSearchParams: () => mockSearchParams,
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    messages: {
      sendTemplate: mockSendTemplate,
      send: mock(() => Promise.resolve({ ok: true })),
      sendInteractive: mock(() => Promise.resolve({ ok: true })),
      list: mock(() => Promise.resolve({ ok: true, messages: [] })),
    },
    conversations: { list: mockConversationsList, get: mockConversationsGet },
    devices: { list: mockDevicesList },
    webhooks: { stats: mock(() => Promise.resolve({ ok: true, data: null })) },
    broadcasts: { summary: mock(() => Promise.resolve({ total: 0 })) },
    usage: { overview: mock(() => Promise.resolve({ ok: true, month: [], today: [], cost: null })) },
  },
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: () => ({ templates: mockTemplatesData, loading: false, error: null, reload: mock(() => Promise.resolve()) }),
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
    mockRouterPush.mockClear()
    mockRouterReplace.mockClear()
    mockConversationsList.mockClear()
    mockConversationsGet.mockClear()
    mockSendTemplate.mockClear()
    mockDevicesList.mockClear()
    mockSearchParams = new URLSearchParams()
    mockConversationsList.mockResolvedValue({ ok: true, conversations: [] })
    mockConversationsGet.mockResolvedValue({
      ok: true,
      conversation: { id: "conv_default", organizationId: "org_1", contactPhone: "+6280000000000", lastMessageAt: null, lastDirection: null, whatsappDeviceId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { whatsappMessages: 0 }, whatsappMessages: [] },
    })
    mockDevicesList.mockResolvedValue({ ok: true, devices: [{ id: "device_1", name: "Test Device", phoneNumber: "+6281234567890", status: "ACTIVE", organizationId: "org_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] })
    mockSendTemplate.mockResolvedValue({ ok: true, messageId: "msg_123", status: "queued" })
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

  it("opens send dialog and shows 2-column layout", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled() })
    await tick(50)
    fireEvent.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })
    expect(view.getByText("Phone Number *")).toBeInTheDocument()
    expect(view.queryByText("Device *")).not.toBeInTheDocument()
    expect(view.getByText("+6281234567890")).toBeInTheDocument()
    expect(view.getByText("Template *")).toBeInTheDocument()
    expect(view.getByText("Message Preview")).toBeInTheDocument()
    fireEvent.change(view.getByPlaceholderText("+628123456789"), { target: { value: "+6289876543210" } })
    fireEvent.click(view.getAllByText("hello_world")[0])
    expect(view.getByRole("button", { name: /send template message/i })).not.toBeDisabled()
    view.unmount()
  })

  it("shows send button enabled after filling all fields", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled() })
    await tick(100)
    fireEvent.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })
    fireEvent.change(view.getByPlaceholderText("+628123456789"), { target: { value: "+6289876543210" } })
    fireEvent.click(view.getAllByText("hello_world")[0])
    await waitFor(() => { expect(view.queryByPlaceholderText("Value for {{1}}")).toBeInTheDocument() })
    fireEvent.change(view.getByPlaceholderText("Value for {{1}}"), { target: { value: "John" } })
    fireEvent.change(view.getByPlaceholderText("Value for {{2}}"), { target: { value: "Acme Corp" } })
    await tick(100)
    expect(view.getByRole("button", { name: /send template message/i })).not.toBeDisabled()
    view.unmount()
  })

  it("does not render old free-form message fields", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument() })
    expect(view.queryByText("Message *")).not.toBeInTheDocument()
    expect(view.queryByText(/interactive message/i)).not.toBeInTheDocument()
    expect(view.queryByText(/reply buttons/i)).not.toBeInTheDocument()
    expect(view.queryByText(/cta url/i)).not.toBeInTheDocument()
    view.unmount()
  })

  it("accepts Indonesian local phone 085708296482", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled() })
    await tick(50)
    fireEvent.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })
    await tick(50)
    const phoneInput = view.getByPlaceholderText("+628123456789") as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: "085708296482" } })
    expect(phoneInput.value).toBe("085708296482")
    fireEvent.click(view.getAllByText("hello_world")[0])
    await waitFor(() => { expect(view.queryByPlaceholderText("Value for {{1}}")).toBeInTheDocument() })
    await tick(50)
    fireEvent.change(view.getByPlaceholderText("Value for {{1}}"), { target: { value: "John" } })
    fireEvent.change(view.getByPlaceholderText("Value for {{2}}"), { target: { value: "5" } })
    await tick(50)
    expect(view.getByRole("button", { name: /send template message/i })).not.toBeDisabled()
    view.unmount()
  })

  it("collapses template picker after selection and shows Change Template button", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled() })
    await tick(50)
    fireEvent.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })
    expect(view.getByPlaceholderText("Type to filter templates...")).toBeInTheDocument()
    fireEvent.click(view.getAllByText("hello_world")[0])
    await tick(50)
    expect(view.queryByPlaceholderText("Type to filter templates...")).not.toBeInTheDocument()
    expect(view.getByRole("button", { name: "Change Template" })).toBeInTheDocument()
    fireEvent.click(view.getByRole("button", { name: "Change Template" }))
    await tick(50)
    expect(view.getByPlaceholderText("Type to filter templates...")).toBeInTheDocument()
    view.unmount()
  })


  it("lacks Conversations heading and search has correct aria-label", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument() })
    expect(view.queryByText("Conversations")).not.toBeInTheDocument()
    expect(view.getByPlaceholderText("Search phone number...")).toHaveAttribute("aria-label", "Search conversations by phone number")
    view.unmount()
  })

  it("shows template preview with filled values when fields are entered", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).not.toBeDisabled() })
    await tick(100)
    fireEvent.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })
    fireEvent.change(view.getByPlaceholderText("+628123456789"), { target: { value: "+6289876543210" } })
    fireEvent.click(view.getAllByText("hello_world")[0])
    await waitFor(() => { expect(view.queryByPlaceholderText("Value for {{1}}")).toBeInTheDocument() })
    await waitFor(() => { expect(view.getByText("Message Preview")).toBeInTheDocument() })
    const field1 = view.getByPlaceholderText("Value for {{1}}") as HTMLInputElement
    fireEvent.change(field1, { target: { value: "Alice" } })
    await tick(100)
    expect(field1.value).toBe("Alice")
    view.unmount()
  })

  it("renders template outbox message as sent bubble from stored body", async () => {
    const recentDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    mockConversationsList.mockResolvedValueOnce({ ok: true, conversations: [{ id: "conv_tpl", organizationId: "org_1", contactPhone: "+6281111111111", lastMessageAt: recentDate, lastDirection: "OUTBOX", whatsappDeviceId: "device_1", createdAt: recentDate, updatedAt: recentDate, _count: { whatsappMessages: 1 } }] })
    mockConversationsGet.mockResolvedValueOnce({ ok: true, conversation: { id: "conv_tpl", organizationId: "org_1", contactPhone: "+6281111111111", lastMessageAt: recentDate, lastDirection: "OUTBOX", whatsappDeviceId: "device_1", createdAt: recentDate, updatedAt: recentDate, _count: { whatsappMessages: 1 }, whatsappMessages: [{ id: "msg_tpl_1", conversationId: "conv_tpl", direction: "OUTBOX", messageType: "template", body: "Hello Alice, your order is confirmed.", mediaUrl: null, waMessageId: null, metadata: { templateName: "hello_world", templateLanguage: "en", fields: ["Alice"] }, createdAt: recentDate, updatedAt: recentDate }] } })
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument() })
    await tick(100)
    fireEvent.click(view.getByText("+6281111111111"))
    await waitFor(() => { expect(view.queryByText("1 messages")).toBeInTheDocument() })
    await tick(50)
    expect(view.getByText("Hello Alice, your order is confirmed.")).toBeInTheDocument()
    view.unmount()
  })

  it("updates the URL when a conversation is selected", async () => {
    mockConversationsList.mockResolvedValueOnce({ ok: true, conversations: [{ id: "conv_1", organizationId: "org_1", contactPhone: "+6281234567890", lastMessageAt: new Date().toISOString(), lastDirection: "OUTBOX", whatsappDeviceId: "device_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { whatsappMessages: 1 } }] })
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByText("+6281234567890")).toBeInTheDocument() })
    await tick(50)
    fireEvent.click(view.getByText("+6281234567890"))
    await tick(50)
    expect(mockRouterReplace).toHaveBeenCalledWith("/en/console/whatsapp/messages?phone=6281234567890", { scroll: false })
    view.unmount()
  })

  it("selects a conversation from the phone query parameter", async () => {
    mockSearchParams = new URLSearchParams("phone=6281234567890")
    mockConversationsList.mockResolvedValueOnce({ ok: true, conversations: [{ id: "conv_1", organizationId: "org_1", contactPhone: "+6281234567890", lastMessageAt: new Date().toISOString(), lastDirection: "OUTBOX", whatsappDeviceId: "device_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { whatsappMessages: 1 } }] })
    const view = render(<WhatsAppMessagesPage />)
    await tick(50)
    await waitFor(() => { expect(mockConversationsGet).toHaveBeenCalledWith("conv_1") })
    view.unmount()
  })

  it("applies bounded-layout CSS classes to thread grid and cards", async () => {
    const view = render(<WhatsAppMessagesPage />)
    await waitFor(() => { expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument() })
    expect(view.container.querySelectorAll(".flex-1").length).toBeGreaterThanOrEqual(1)
    expect(view.container.querySelectorAll(".min-h-0").length).toBeGreaterThanOrEqual(3)
    expect(view.container.querySelector(".min-h-\\[500px\\]")).toBeNull()
    view.unmount()
  })

  it("sends a template and updates URL when send succeeds", async () => {
    mockConversationsList.mockResolvedValueOnce({ ok: true, conversations: [] })

    const view = render(<WhatsAppMessagesPage />)
    const user = userEvent.setup()
    await waitFor(() => { expect(mockConversationsList).toHaveBeenCalledTimes(1) })
    await tick(50)

    // Open dialog
    await user.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })

    // Fill phone
    const phoneInput = view.getByPlaceholderText("+628123456789") as HTMLInputElement
    await user.type(phoneInput, "+6289876543210")
    expect(phoneInput.value).toBe("+6289876543210")

    // Select template and fill fields
    await user.click(view.getAllByText("hello_world")[0])
    await waitFor(() => { expect(view.queryByPlaceholderText("Value for {{1}}")).toBeInTheDocument() })
    await user.type(view.getByPlaceholderText("Value for {{1}}"), "Alice")
    await user.type(view.getByPlaceholderText("Value for {{2}}"), "Acme Corp")
    await tick(50)

    // Set up post-send mocks
    mockConversationsList.mockResolvedValueOnce({ ok: true, conversations: [{ id: "conv_new", organizationId: "org_1", contactPhone: "+6289876543210", lastMessageAt: new Date().toISOString(), lastDirection: "OUTBOX", whatsappDeviceId: "device_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { whatsappMessages: 1 } }] })
    mockConversationsGet.mockResolvedValueOnce({ ok: true, conversation: { id: "conv_new", organizationId: "org_1", contactPhone: "+6289876543210", lastMessageAt: new Date().toISOString(), lastDirection: "OUTBOX", whatsappDeviceId: "device_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { whatsappMessages: 1 }, whatsappMessages: [] } })

    // Click send button via userEvent
    const sendBtn = view.getByRole("button", { name: /send template message/i })
    expect(sendBtn).not.toBeDisabled()
    await user.click(sendBtn)
    await tick(100)

    // Verify send was called
    expect(mockSendTemplate).toHaveBeenCalled()

    // Verify URL was updated
    expect(mockRouterReplace).toHaveBeenCalledWith("/en/console/whatsapp/messages?phone=6289876543210", { scroll: false })

    // Verify conversation lookup was triggered
    expect(mockConversationsList).toHaveBeenCalledWith({ contactPhone: "+6289876543210" })
    await waitFor(() => { expect(mockConversationsGet).toHaveBeenCalledWith("conv_new") })

    view.unmount()
  })

  it("updates URL even when post-send lookup fails", async () => {
    mockConversationsList.mockResolvedValueOnce({ ok: true, conversations: [] })

    const view = render(<WhatsAppMessagesPage />)
    const user = userEvent.setup()
    await waitFor(() => { expect(mockConversationsList).toHaveBeenCalledTimes(1) })
    await tick(50)

    // Open dialog
    await user.click(view.getByRole("button", { name: /new message/i }))
    await waitFor(() => { expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument() })

    // Fill phone
    await user.type(view.getByPlaceholderText("+628123456789"), "+6289876543210")
    await user.click(view.getAllByText("hello_world")[0])
    await waitFor(() => { expect(view.queryByPlaceholderText("Value for {{1}}")).toBeInTheDocument() })
    await user.type(view.getByPlaceholderText("Value for {{1}}"), "Alice")
    await user.type(view.getByPlaceholderText("Value for {{2}}"), "Acme Corp")
    await tick(50)

    // Post-send lookup rejects — dialog must still close and URL must still update
    mockConversationsList.mockRejectedValueOnce(new Error("lookup failed"))

    const sendBtn = view.getByRole("button", { name: /send template message/i })
    expect(sendBtn).not.toBeDisabled()
    await user.click(sendBtn)
    await tick(100)

    // Verify send was still called
    expect(mockSendTemplate).toHaveBeenCalled()

    // URL still updated even when lookup fails
    expect(mockRouterReplace).toHaveBeenCalledWith("/en/console/whatsapp/messages?phone=6289876543210", { scroll: false })

    view.unmount()
  })
})
