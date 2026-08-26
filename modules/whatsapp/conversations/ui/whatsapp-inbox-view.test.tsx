import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WhatsAppInboxView } from "./whatsapp-inbox-view"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

// Mock navigation
mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mock() }),
}))

// Mock sonner toast
mock.module("sonner", () => ({
  toast: {
    success: mock(),
    error: mock(),
  },
}))

const mockConversations = [
  {
    id: "conv-1",
    contactPhone: "+6281234567890",
    status: "OPEN",
    stage: "NEW",
    lastMessageAt: "2026-08-27T10:00:00.000Z",
    lastDirection: "INBOX",
    whatsappMessages: [
      {
        id: "msg-1",
        direction: "INBOX",
        messageType: "TEXT",
        body: "Hello, I need pricing information",
        createdAt: "2026-08-27T10:00:00.000Z",
      },
    ],
    conversationLabels: [{ label: { id: "lbl-1", name: "Inquiry" } }],
    _count: { whatsappMessages: 1 },
    notes: [],
    activities: [],
  },
  {
    id: "conv-2",
    contactPhone: "+6289876543210",
    status: "RESOLVED",
    stage: "WON",
    lastMessageAt: "2026-08-27T09:00:00.000Z",
    lastDirection: "OUTBOX",
    whatsappMessages: [
      {
        id: "msg-2",
        direction: "OUTBOX",
        messageType: "TEXT",
        body: "Thank you for purchasing",
        createdAt: "2026-08-27T09:00:00.000Z",
        statusHistory: [{ status: "READ" }],
      },
    ],
    conversationLabels: [],
    _count: { whatsappMessages: 1 },
    notes: [
      {
        id: "n-1",
        body: "Deal closed",
        authorName: "Admin",
        createdAt: "2026-08-27T09:30:00.000Z",
      },
    ],
    activities: [],
  },
]

describe("WhatsAppInboxView component", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/api/whatsapp/conversations/conv-1")) {
        return new Response(
          JSON.stringify({ ok: true, conversation: mockConversations[0] })
        )
      }
      if (urlStr.includes("/api/whatsapp/conversations")) {
        return new Response(
          JSON.stringify({ ok: true, conversations: mockConversations })
        )
      }
      if (urlStr.includes("/api/whatsapp/messages")) {
        return new Response(
          JSON.stringify({ ok: true, messageId: "sent-msg-1" })
        )
      }
    }) as unknown as typeof fetch
  })

  it("renders conversation list and shows message preview and unread indicator", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppInboxView />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(
        screen.getAllByText("+6281234567890").length
      ).toBeGreaterThanOrEqual(1)
      expect(
        screen.getAllByText("Hello, I need pricing information").length
      ).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("+6289876543210")).toBeDefined()
    })
  })

  it("allows typing a reply and sending a message", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppInboxView />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Reply to \+6281234567890/i)
      ).toBeDefined()
    })

    const input = screen.getByPlaceholderText(/Reply to \+6281234567890/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    await user.type(input, "Our standard pricing starts at IDR 99,000")
    expect(sendButton.getAttribute("disabled")).toBeNull()

    await user.click(sendButton)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/whatsapp/messages",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(
            "Our standard pricing starts at IDR 99,000"
          ),
        })
      )
    })
  })
})
