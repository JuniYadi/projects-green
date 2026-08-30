import { describe, expect, it, mock } from "bun:test"
import { renderToString } from "react-dom/server"

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
    warning: mock(() => {}),
  },
}))

import AiAgentsPage from "./page"

describe("AiAgentsPage", () => {
  it("renders Master Agent Profiles and Create button", () => {
    const html = renderToString(<AiAgentsPage />)
    expect(html).toContain("AI Studio &amp; Asisten WhatsApp")
    expect(html).toContain("Buat Alur / Asisten AI Baru")
    expect(html).toContain("Belum ada alur / asisten AI dibuat")
  })
})
