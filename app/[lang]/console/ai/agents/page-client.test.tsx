import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
  useRouter: () => ({ push: mock(() => {}) }),
}))

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
    warning: mock(() => {}),
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          agents: {
            get: mock(() =>
              Promise.resolve({
                data: {
                  ok: true,
                  data: [
                    {
                      id: "agent_1",
                      name: "Tanya CS",
                      description: "CS otomatis",
                      status: "DRAFT",
                      operationalStatus: "READY_TO_CONNECT",
                      activeChannelsCount: 0,
                      knowledgeCount: 0,
                      actionCount: 0,
                      channelBindings: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ],
                },
              })
            ),
            post: mock(() =>
              Promise.resolve({
                data: { ok: true, data: { id: "agent_2", name: "New Agent" } },
              })
            ),
          },
        },
      },
      whatsapp: {
        devices: {
          get: mock(() => Promise.resolve({ data: { devices: [] } })),
        },
      },
    },
  },
}))

import AiAgentsPageClient from "./page-client"

describe("AiAgentsPageClient", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the operational dashboard", () => {
    const { getByText, getByPlaceholderText } = render(<AiAgentsPageClient />)
    expect(getByText("AI Agents")).toBeDefined()
    expect(getByText("Buat Agent")).toBeDefined()
    expect(getByPlaceholderText("Cari agent")).toBeDefined()
  })

  it("renders a truthful status and one primary action", async () => {
    const { findByText, findByTestId } = render(<AiAgentsPageClient />)
    expect(await findByText("Tanya CS")).toBeDefined()
    expect(await findByText("Belum ada channel")).toBeDefined()
    const card = await findByTestId("agent-card-agent_1")
    expect(card.textContent).not.toContain("Bantu pelanggan")
    expect(card.textContent).not.toContain("Aktif")
    expect(card.querySelectorAll("button").length).toBe(3)
  })

  it("filters agents by search", async () => {
    const { findByText, getByPlaceholderText, queryByText } = render(
      <AiAgentsPageClient />
    )
    await findByText("Tanya CS")
    fireEvent.change(getByPlaceholderText("Cari agent"), {
      target: { value: "tidak ada" },
    })
    expect(queryByText("Tanya CS")).toBeNull()
  })

  it("keeps templates hidden and closes create dialog on cancel", async () => {
    const { findByText, getByText, queryByText } = render(
      <AiAgentsPageClient />
    )
    fireEvent.click(getByText("Buat Agent"))
    expect(await findByText("Lihat template")).toBeDefined()
    expect(queryByText("📦 Cek Status Resi")).toBeNull()
    fireEvent.click(getByText("Batal"))
    expect(queryByText("Rancang Asisten & Alur Otomatis")).toBeNull()
  })
})
