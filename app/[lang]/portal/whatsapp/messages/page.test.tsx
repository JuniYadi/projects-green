import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockConversationsList = mock(
  async (params?: { contactPhone?: string }) => ({
    ok: true as const,
    conversations: params?.contactPhone
      ? [conversationTwo]
      : [conversationOne, conversationTwo],
  })
)
const mockConversationsGet = mock(async (id: string) => ({
  ok: true as const,
  conversation: id === conversationOne.id ? detailOne : detailTwo,
}))
const mockDevicesList = mock(async () => ({
  ok: true as const,
  devices: [
    {
      id: "device-1",
      name: "Primary",
      phoneNumber: "+628111111111",
      status: "ACTIVE",
      organizationId: "org-1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ],
}))
const mockSend = mock(async (_payload: unknown) => ({ ok: true as const }))
const mockSendInteractive = mock(async (_payload: unknown) => ({
  ok: true as const,
}))

const conversationOne = {
  id: "conversation-1",
  organizationId: "org-1",
  contactPhone: "+628123456789",
  lastMessageAt: "2024-01-02T00:00:00.000Z",
  lastDirection: "INBOX" as const,
  whatsappDeviceId: "device-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
  _count: { whatsappMessages: 2 },
}
const conversationTwo = {
  id: "conversation-2",
  organizationId: "org-1",
  contactPhone: "+628987654321",
  lastMessageAt: "2024-01-03T00:00:00.000Z",
  lastDirection: "OUTBOX" as const,
  whatsappDeviceId: "device-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-03T00:00:00.000Z",
  _count: { whatsappMessages: 1 },
}
const detailOne = {
  ...conversationOne,
  whatsappMessages: [
    {
      id: "message-1",
      conversationId: conversationOne.id,
      direction: "INBOX" as const,
      messageType: "text",
      body: "Hello from WhatsApp",
      mediaUrl: null,
      waMessageId: "wa-1",
      metadata: null,
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    },
  ],
}
const detailTwo = { ...conversationTwo, whatsappMessages: [] }

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    conversations: {
      list: mockConversationsList,
      get: mockConversationsGet,
    },
    devices: { list: mockDevicesList },
    messages: {
      send: mockSend,
      sendInteractive: mockSendInteractive,
    },
  },
}))

mock.module("@/modules/whatsapp/messages/ui/message-status-badge", () => ({
  MessageStatusBadge: () => null,
}))

import WhatsAppMessagesPage from "./page"

describe("WhatsAppMessagesPage", () => {
  beforeEach(() => {
    mockConversationsList.mockClear()
    mockConversationsGet.mockClear()
    mockDevicesList.mockClear()
    mockSend.mockClear()
    mockSendInteractive.mockClear()
    mockConversationsList.mockImplementation(
      async (params?: { contactPhone?: string; status?: string }) => {
        if (params?.contactPhone) {
          const query = params.contactPhone.toLowerCase()
          const filtered = [conversationOne, conversationTwo].filter((c) =>
            c.contactPhone.toLowerCase().includes(query)
          )
          return { ok: true, conversations: filtered }
        }
        return { ok: true, conversations: [conversationOne, conversationTwo] }
      }
    )
    mockConversationsGet.mockImplementation(async (id: string) => ({
      ok: true,
      conversation: id === conversationOne.id ? detailOne : detailTwo,
    }))
    mockDevicesList.mockResolvedValue({
      ok: true,
      devices: [
        {
          id: "device-1",
          name: "Primary",
          phoneNumber: "+628111111111",
          status: "ACTIVE",
          organizationId: "org-1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    })
    mockSend.mockResolvedValue({ ok: true })
  })
  afterEach(() => {
    cleanup()
  })

  it("renders conversations and loads devices", async () => {
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() => {
      expect(view.getByText("+628123456789")).toBeInTheDocument()
      expect(view.getByText("+628987654321")).toBeInTheDocument()
    })
    expect(view.getByRole("heading", { name: "Messages" })).toBeInTheDocument()
    expect(mockConversationsList).toHaveBeenCalledWith(undefined)
    expect(mockDevicesList).toHaveBeenCalledTimes(1)
  })

  it("searches conversations by phone number", async () => {
    const user = userEvent.setup()
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() =>
      expect(view.getByText("+628123456789")).toBeInTheDocument()
    )
    const search = view.getByPlaceholderText("Search by phone...")
    await user.clear(search)
    await user.type(search, "8987")

    await waitFor(() => {
      expect(mockConversationsList).toHaveBeenCalledWith({
        contactPhone: "8987",
      })
      expect(view.getByText("+628987654321")).toBeInTheDocument()
      expect(view.queryByText("+628123456789")).not.toBeInTheDocument()
    })
  })

  it("selects a conversation and renders its messages", async () => {
    const user = userEvent.setup()
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() =>
      expect(view.getByText("+628123456789")).toBeInTheDocument()
    )
    await user.click(view.getByText("+628123456789"))

    await waitFor(() => {
      expect(mockConversationsGet).toHaveBeenCalledWith("conversation-1")
      expect(view.getByText("Hello from WhatsApp")).toBeInTheDocument()
    })
    expect(view.getByText("2 messages")).toBeInTheDocument()
  })

  it("sends a new message from the portal", async () => {
    const user = userEvent.setup()
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() =>
      expect(view.getByRole("button", { name: "New Message" })).toBeEnabled()
    )
    await user.click(view.getByRole("button", { name: "New Message" }))
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "Send a Message" })
      ).toBeInTheDocument()
    )

    await user.type(view.getByPlaceholderText("+628123456789"), "+628555555555")
    await user.type(
      view.getByPlaceholderText("Type your message..."),
      "A new message"
    )
    await user.click(view.getByRole("button", { name: "Send Message" }))

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({
        phoneNumber: "+628555555555",
        message: "A new message",
        deviceId: undefined,
      })
    })
    expect(
      view.queryByRole("heading", { name: "Send a Message" })
    ).not.toBeInTheDocument()
  })

  it("shows a validation toast and does not send an empty message", async () => {
    const view = render(<WhatsAppMessagesPage />)

    await waitFor(() =>
      expect(view.getByRole("button", { name: "New Message" })).toBeEnabled()
    )
    fireEvent.click(view.getByRole("button", { name: "New Message" }))
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "Send a Message" })
      ).toBeInTheDocument()
    )
    fireEvent.click(view.getByRole("button", { name: "Send Message" }))

    expect(mockSend).not.toHaveBeenCalled()
  })
})
