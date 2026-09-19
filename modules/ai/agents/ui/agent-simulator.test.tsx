import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

const mockSimulatePost = mock((_arg?: unknown) =>
  Promise.resolve({
    data: {
      ok: true,
      data: {
        replyText: "Halo! Paket Anda sedang dikirim.",
        rawText: "Halo! Paket Anda sedang dikirim. <button title=\"Cek Resi\">",
        interactiveButtons: [
          {
            type: "reply" as const,
            title: "Cek Resi Lain",
            payload: "CHECK_ANOTHER",
          },
          {
            type: "cta_url" as const,
            title: "Buka Tracking",
            url: "https://track.example.com",
          },
        ],
        toolCalls: [
          {
            toolName: "checkShippingStatus",
            args: { trackingNumber: "JNE-12345" },
            output: { status: "DELIVERED", city: "Jakarta" },
            status: "SUCCESS" as const,
            durationMs: 124,
          },
        ],
        usage: {
          promptTokens: 150,
          completionTokens: 40,
          totalTokens: 190,
          latencyMs: 250,
        },
      },
    },
  })
)

const mockToastError = mock(() => {})
const mockToastSuccess = mock(() => {})

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          simulate: {
            post: mockSimulatePost,
          },
        },
      },
    },
  },
}))

mock.module("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}))

import AgentSimulator from "./agent-simulator"

describe("AgentSimulator Component", () => {
  const mockAgents = [
    {
      id: "agent-1",
      name: "Asisten Logistik",
      description: "Membantu tracking resi dan pengiriman",
      isActive: true,
    },
    {
      id: "agent-2",
      name: "CS Pembayaran",
      description: "Membantu konfirmasi invoice",
      isActive: true,
    },
  ]

  beforeEach(() => {
    mockSimulatePost.mockClear()
    mockToastError.mockClear()
    mockToastSuccess.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header, agent name, empty chat, and empty inspector", () => {
    const { getAllByText, getByText, getByPlaceholderText } = render(
      <AgentSimulator
        agents={mockAgents}
        selectedAgentId="agent-1"
        lang="id"
      />
    )

    expect(getAllByText("Asisten Logistik").length).toBeGreaterThan(0)
    expect(getByText("Sandbox Uji Coba")).toBeDefined()
    expect(
      getByPlaceholderText("Ketik pesan pengujian WhatsApp...")
    ).toBeDefined()
    expect(getByText("Inspektur Eksekusi")).toBeDefined()
    expect(getByText("Belum Ada Data Eksekusi")).toBeDefined()
  })

  it(
    "sends message and renders assistant reply, usage, and tool trace",
    async () => {
      const { getByPlaceholderText, getByText } = render(
        <AgentSimulator
          agents={mockAgents}
          selectedAgentId="agent-1"
          lang="id"
        />
      )

    const input = getByPlaceholderText("Ketik pesan pengujian WhatsApp...")
    fireEvent.change(input, { target: { value: "Dimana paket saya?" } })

    const sendBtn = getByText("Kirim")
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(mockSimulatePost).toHaveBeenCalledTimes(1)
    })

    // Verify user bubble & assistant bubble
    expect(getByText("Dimana paket saya?")).toBeDefined()
    expect(getByText("Halo! Paket Anda sedang dikirim.")).toBeDefined()

    // Verify telemetry metrics rendered in inspector
    expect(getByText("190")).toBeDefined() // totalTokens
    expect(getByText("150")).toBeDefined() // promptTokens
    expect(getByText("40")).toBeDefined() // completionTokens
    expect(getByText("250ms")).toBeDefined() // latencyMs

    // Verify tool execution trace
    expect(getByText("checkShippingStatus")).toBeDefined()
    expect(getByText("SUCCESS")).toBeDefined()
    expect(getByText("124ms")).toBeDefined()

    // Verify interactive buttons rendered
    expect(getByText("Cek Resi Lain")).toBeDefined()
    expect(getByText("Buka Tracking")).toBeDefined()
  })

  it("expands tool arguments and output JSON viewer", async () => {
    const { getByPlaceholderText, getByText } = render(
      <AgentSimulator agents={mockAgents} selectedAgentId="agent-1" lang="id" />
    )

    const input = getByPlaceholderText("Ketik pesan pengujian WhatsApp...")
    fireEvent.change(input, { target: { value: "Test Tool Args" } })
    fireEvent.click(getByText("Kirim"))

    await waitFor(() => {
      expect(getByText("checkShippingStatus")).toBeDefined()
    })

    // Click tool to expand
    const toolTrigger = getByText("checkShippingStatus")
    fireEvent.click(toolTrigger)

    // Verify arguments and output JSON appear
    await waitFor(() => {
      expect(getByText("Argumen Masukan:")).toBeDefined()
      expect(getByText("Hasil Eksekusi:")).toBeDefined()
    })
  })

  it(
    "clicking quick reply button sends title as next user message",
    async () => {
      const { getByPlaceholderText, getByText } = render(
        <AgentSimulator
          agents={mockAgents}
          selectedAgentId="agent-1"
          lang="id"
        />
      )

    // First turn
    const input = getByPlaceholderText("Ketik pesan pengujian WhatsApp...")
    fireEvent.change(input, { target: { value: "Halo" } })
    fireEvent.click(getByText("Kirim"))

    await waitFor(() => {
      expect(getByText("Cek Resi Lain")).toBeDefined()
    })

    // Click interactive button
    const replyBtn = getByText("Cek Resi Lain")
    fireEvent.click(replyBtn)

    await waitFor(() => {
      expect(mockSimulatePost).toHaveBeenCalledTimes(2)
    })

    // Second call payload should contain message: "Cek Resi Lain"
    const secondCall = mockSimulatePost.mock.calls[1] as unknown[]
    const secondCallArg = secondCall[0] as {
      message: string
      conversationHistory: { role: string; content: string }[]
    }
    expect(secondCallArg.message).toBe("Cek Resi Lain")
    expect(secondCallArg.conversationHistory.length).toBeGreaterThan(0)
  })

  it("clears conversation when clear button is clicked", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <AgentSimulator agents={mockAgents} selectedAgentId="agent-1" lang="id" />
    )

    const input = getByPlaceholderText("Ketik pesan pengujian WhatsApp...")
    fireEvent.change(input, { target: { value: "Pesan sebelum hapus" } })
    fireEvent.click(getByText("Kirim"))

    await waitFor(() => {
      expect(getByText("Pesan sebelum hapus")).toBeDefined()
    })

    // Click Hapus Obrolan
    const clearBtn = getByText("Hapus Obrolan")
    fireEvent.click(clearBtn)

    expect(queryByText("Pesan sebelum hapus")).toBeNull()
    expect(getByText("Belum Ada Data Eksekusi")).toBeDefined()
  })

  it("shows error toast when simulate API fails", async () => {
    mockSimulatePost.mockImplementationOnce(() =>
      Promise.reject(new Error("Network connection error"))
    )

    const { getByPlaceholderText, getByText } = render(
      <AgentSimulator agents={mockAgents} selectedAgentId="agent-1" lang="id" />
    )

    const input = getByPlaceholderText("Ketik pesan pengujian WhatsApp...")
    fireEvent.change(input, { target: { value: "Trigger Error" } })
    fireEvent.click(getByText("Kirim"))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Network connection error")
    })
  })
})
