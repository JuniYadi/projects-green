import { describe, expect, it } from "bun:test"
import { renderToString } from "react-dom/server"
import AiAgentsPage from "./page"

describe("AiAgentsPage", () => {
  it("renders Master Agent Profiles and Create button", () => {
    const html = renderToString(<AiAgentsPage />)
    expect(html).toContain("AI Studio &amp; Asisten WhatsApp")
    expect(html).toContain("Buat Alur / Asisten AI Baru")
  })
})
