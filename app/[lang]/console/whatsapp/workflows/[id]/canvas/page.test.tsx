import { describe, expect, it, mock } from "bun:test"
import { renderToString } from "react-dom/server"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", id: "new" }),
  useRouter: () => ({ push: mock(() => {}) }),
}))

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
    warning: mock(() => {}),
  },
}))

import WhatsappWorkflowCanvasPage from "./page"

describe("WhatsappWorkflowCanvasPage", () => {
  it("renders Canvas header, AI Copilot, and simulator trigger button", () => {
    const html = renderToString(<WhatsappWorkflowCanvasPage />)
    expect(html).toContain("Visual Canvas")
    expect(html).toContain("AI Copilot Canvas")
    expect(html).toContain("Tes Simulator")
  })
})
