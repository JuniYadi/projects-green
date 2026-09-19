import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

const mockAgentsGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: [
        {
          id: "agent-alpha",
          name: "Asisten Alpha",
          description: "Bot customer support",
          systemPrompt: "Jawab sopan",
          dailyUserLimit: 20,
          enableProfanityFilter: true,
          allowInteractiveReplies: true,
          channelsCount: 1,
          isActive: true,
        },
      ],
    },
  })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          agents: {
            get: mockAgentsGet,
          },
          actions: {
            get: mock(() => Promise.resolve({ data: { ok: true, data: [] } })),
          },
          connections: {
            get: mock(() => Promise.resolve({ data: { ok: true, data: [] } })),
          },
          simulate: {
            post: mock(() =>
              Promise.resolve({
                data: {
                  ok: true,
                  data: {
                    replyText: "Halo dari simulator!",
                    rawText: "Halo dari simulator!",
                    interactiveButtons: [],
                    toolCalls: [],
                    usage: {
                      promptTokens: 10,
                      completionTokens: 10,
                      totalTokens: 20,
                      latencyMs: 100,
                    },
                  },
                },
              })
            ),
          },
        },
      },
      whatsapp: {
        devices: {
          get: mock(() =>
            Promise.resolve({
              data: { devices: [] },
            })
          ),
        },
      },
    },
  },
}))

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
  useRouter: () => ({ push: mock(() => {}) }),
}))

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
  },
}))

import AiAgentsPage from "./page-client"

describe("AiAgentsPage with Simulator tab", () => {
  beforeEach(() => {
    mockAgentsGet.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders Master Agent Profiles and Create button", async () => {
    const { findAllByText, findByText } = render(<AiAgentsPage />)
    const elements = await findAllByText("AI Studio & Asisten WhatsApp")
    expect(elements.length).toBeGreaterThan(0)
    expect(await findByText("Buat Alur / Asisten AI Baru")).toBeDefined()
  })

  it("renders Simulator tab trigger alongside existing tabs", async () => {
    const { getByRole, findByText } = render(<AiAgentsPage />)

    // Wait for agents to load
    await findByText("Asisten Alpha")

    // Check simulator tab trigger exists
    const simulatorTab = getByRole("tab", { name: /Simulator & Inspector/i })
    expect(simulatorTab).toBeDefined()
  })

  it(
    "switches to simulator tab when card Simulator button is clicked",
    async () => {
    const { findByText, getAllByText, getByRole } = render(<AiAgentsPage />)

    await findByText("Asisten Alpha")

    // Find the Simulator quick action button on the card
    const simulatorBtns = getAllByText("Simulator")
    expect(simulatorBtns.length).toBeGreaterThan(0)

    // Click the button on the card
    fireEvent.click(simulatorBtns[0])

    // Verify simulator tab is now active
    await waitFor(() => {
      const simulatorTab = getByRole("tab", {
        name: /Simulator & Inspector/i,
      })
      expect(simulatorTab.getAttribute("data-state")).toBe("active")
    })
  })
})
