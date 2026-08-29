import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const mockConversationsList = mock(
  async (params?: {
    contactPhone?: string
    organizationId?: string
    whatsappDeviceId?: string
  }) => ({
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
const mockSendTemplate = mock(async (_payload: unknown) => ({
  ok: true as const,
  jobId: "job-1",
  messageId: "msg-1",
  waMessageId: "wa-1",
  status: "sent" as const,
}))

const nowIso = new Date().toISOString()
const conversationOne = {
  id: "conversation-1",
  organizationId: "org-1",
  contactPhone: "+628123456789",
  lastMessageAt: nowIso,
  lastDirection: "INBOX" as const,
  whatsappDeviceId: "device-1",
  createdAt: nowIso,
  updatedAt: nowIso,
  _count: { whatsappMessages: 2 },
}
const conversationTwo = {
  id: "conversation-2",
  organizationId: "org-1",
  contactPhone: "+628987654321",
  lastMessageAt: nowIso,
  lastDirection: "OUTBOX" as const,
  whatsappDeviceId: "device-1",
  createdAt: nowIso,
  updatedAt: nowIso,
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
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ],
}
const detailTwo = { ...conversationTwo, whatsappMessages: [] }

const mockAdminOrgs = [
  { id: "org-1", name: "Organization 1" },
  { id: "org-2", name: "Organization 2" },
]

const mockAdminDevices = [
  {
    id: "device-1",
    name: "Primary Device",
    phoneNumber: "+628111111111",
    status: "ACTIVE",
    organizationId: "org-1",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
]

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        organizations: {
          get: mock(async () => ({
            data: { ok: true, data: { organizations: mockAdminOrgs } },
          })),
        },
        devices: {
          get: mock(async () => ({
            data: { ok: true, devices: mockAdminDevices },
          })),
        },
      },
    },
  },
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mock(() => {}), replace: mock(() => {}) }),
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/en/portal/whatsapp/messages",
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    conversations: {
      list: mockConversationsList,
      get: mockConversationsGet,
      update: mock(async () => ({ ok: true })),
      delete: mock(async () => ({ ok: true })),
      getLabels: mock(async () => ({ ok: true, labels: [] })),
    },
    devices: { list: mockDevicesList },
    messages: {
      send: mockSend,
      sendInteractive: mockSendInteractive,
      sendTemplate: mockSendTemplate,
    },
    webhooks: { stats: mock(async () => ({ ok: true })) },
    broadcasts: { summary: mock(async () => ({ total: 0 })) },
    usage: { overview: mock(async () => ({ ok: true })) },
  },
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: () => ({
    templates: [],
    loading: false,
    error: null,
    reload: mock(async () => {}),
  }),
  useTemplate: () => ({
    template: null,
    loading: false,
    error: null,
    reload: mock(async () => {}),
  }),
}))

mock.module("@/modules/whatsapp/messages/ui/message-status-badge", () => ({
  MessageStatusBadge: () => null,
}))

import WhatsAppMessagesPage from "./page"

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("Portal WhatsAppMessagesPage", () => {
  beforeEach(() => {
    mockConversationsList.mockClear()
    mockConversationsGet.mockClear()
    mockDevicesList.mockClear()
    mockSend.mockClear()
    mockSendInteractive.mockClear()
    mockSendTemplate.mockClear()
    mockConversationsList.mockImplementation(
      async (params?: {
        contactPhone?: string
        status?: string
        organizationId?: string
        whatsappDeviceId?: string
      }) => {
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

  it("renders conversations and admin filter controls", async () => {
    const view = renderWithQuery(<WhatsAppMessagesPage />)

    await waitFor(() => {
      expect(view.getByText("+628123456789")).toBeInTheDocument()
      expect(view.getByText("+628987654321")).toBeInTheDocument()
    })
    expect(view.getByRole("heading", { name: "Messages" })).toBeInTheDocument()
    expect(view.getByLabelText("Filter by organization")).toBeInTheDocument()
    expect(view.getByLabelText("Filter by device")).toBeInTheDocument()
  })

  it("searches conversations by phone number", async () => {
    const user = userEvent.setup()
    const view = renderWithQuery(<WhatsAppMessagesPage />)

    await waitFor(() =>
      expect(view.getByText("+628123456789")).toBeInTheDocument()
    )
    const search = view.getByPlaceholderText("Search phone number...")
    await user.clear(search)
    await user.type(search, "8987")

    await waitFor(() => {
      expect(view.getByText("+628987654321")).toBeInTheDocument()
      expect(view.queryByText("+628123456789")).not.toBeInTheDocument()
    })
  })

  it("selects a conversation and renders its messages", async () => {
    const user = userEvent.setup()
    const view = renderWithQuery(<WhatsAppMessagesPage />)

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

  it("sends quick reply from the portal when session window is open", async () => {
    const user = userEvent.setup()
    const view = renderWithQuery(<WhatsAppMessagesPage />)

    await waitFor(() =>
      expect(view.getByText("+628123456789")).toBeInTheDocument()
    )
    await user.click(view.getByText("+628123456789"))

    await waitFor(() => {
      expect(view.getByText("Hello from WhatsApp")).toBeInTheDocument()
    })

    const input = view.getByPlaceholderText("Type a message...")
    await user.type(input, "Quick admin reply")
    await user.click(view.getByRole("button", { name: /^send$/i }))

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({
        phoneNumber: "+628123456789",
        message: "Quick admin reply",
        deviceId: "device-1",
      })
    })
  })
})
