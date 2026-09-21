import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"

const mockAgentsGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: [
        {
          id: "agent-alpha",
          name: "Asisten Alpha",
          description: "Bot customer support",
          status: "ACTIVE",
          operationalStatus: "ACTIVE",
          activeChannelsCount: 1,
          channelBindings: [
            {
              id: "binding-alpha",
              channel: "WHATSAPP",
              targetId: "device-alpha",
              targetName: "+628111111",
              isActive: true,
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

  it("renders the agents dashboard and create button", async () => {
    const { findByText } = render(<AiAgentsPage />)
    expect(await findByText("AI Agents")).toBeDefined()
    expect(await findByText("Buat Agent")).toBeDefined()
  })

  it("does not expose advanced tools as global tabs", async () => {
    const { queryByRole, findByText } = render(<AiAgentsPage />)
    await findByText("Asisten Alpha")
    expect(queryByRole("tab", { name: /Simulator & Inspector/i })).toBeNull()
  })

  it("shows one primary action on an active agent", async () => {
    const { findByText, findByTestId } = render(<AiAgentsPage />)
    await findByText("Asisten Alpha")
    const card = await findByTestId("agent-card-agent-alpha")
    expect(card.textContent).toContain("Buka Agent")
    expect(card.querySelectorAll("button").length).toBe(2)
  })
})
