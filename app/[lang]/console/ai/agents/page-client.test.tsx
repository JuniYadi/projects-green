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
                      systemPrompt: "Bantu pelanggan",
                      dailyUserLimit: 20,
                      enableProfanityFilter: true,
                      allowInteractiveReplies: true,
                      channelsCount: 1,
                      isActive: true,
                      channelBindings: [],
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

  it("renders tabs for agents and action intents", () => {
    const { getAllByText, getByText } = render(<AiAgentsPageClient />)
    expect(getAllByText("AI Studio & Asisten WhatsApp").length).toBeGreaterThan(
      0
    )
    expect(getByText("Action Intents & Tools")).toBeDefined()
    expect(getByText("Buat Alur / Asisten AI Baru")).toBeDefined()
  })

  it("renders agent cards with interactive replies status and edit button", async () => {
    const { findByText } = render(<AiAgentsPageClient />)
    expect(await findByText("Tanya CS")).toBeDefined()
    expect(await findByText("Peran Asisten:")).toBeDefined()
    expect(await findByText("Kelola Nomor")).toBeDefined()
    expect(await findByText("Buka di Canvas")).toBeDefined()
    expect(await findByText("Edit Pengaturan")).toBeDefined()
    expect(
      await findByText(
        "Izinkan Tombol Interaktif WhatsApp (Quick Replies & URL Links)"
      )
    ).toBeDefined()
  })

  it("opens edit modal and displays interactive replies toggle and preview", async () => {
    const { findByText, getByText, getByTestId } = render(
      <AiAgentsPageClient />
    )
    const editBtn = await findByText("Edit Pengaturan")
    fireEvent.click(editBtn)

    expect(await findByText("Edit Profil Asisten AI")).toBeDefined()
    expect(getByText("Pratinjau Balasan Interaktif")).toBeDefined()
    expect(getByText("💬 Tanya Produk")).toBeDefined()
    expect(getByText("📦 Cek Pesanan")).toBeDefined()
    expect(getByText("🌐 Kunjungi Website")).toBeDefined()

    const preview = getByTestId("interactive-replies-preview")
    expect(preview.className).toContain("opacity-100")
  })

  it("renders embed website tab and button, navigating to customizer", async () => {
    const { findAllByText, findByText } = render(<AiAgentsPageClient />)
    await findByText("Tanya CS")
    const embedButtons = await findAllByText("Embed Website")
    expect(embedButtons.length).toBeGreaterThanOrEqual(2)

    // Click the card button (second match)
    fireEvent.click(embedButtons[1])

    expect(await findByText("Pengaturan Widget Chat Website")).toBeDefined()
    expect(await findByText("Kustomisasi Tampilan Widget")).toBeDefined()
  })
})
