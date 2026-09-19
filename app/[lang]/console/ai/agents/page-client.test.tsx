import { describe, expect, it, mock } from "bun:test"
import { renderToString } from "react-dom/server"

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

import AiAgentsPageClient from "./page-client"

describe("AiAgentsPageClient", () => {
  it("renders tabs for agents and action intents", () => {
    const html = renderToString(<AiAgentsPageClient />)
    expect(html).toContain("AI Studio &amp; Asisten WhatsApp")
    expect(html).toContain("Action Intents &amp; Tools")
    expect(html).toContain("Buat Alur / Asisten AI Baru")
  })
})
