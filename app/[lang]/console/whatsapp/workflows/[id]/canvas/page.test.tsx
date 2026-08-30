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
    info: mock(() => {}),
  },
}))

// Mock ResizeObserver for xyflow inside server render test
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import WhatsappWorkflowCanvasPage from "./page"

describe("WhatsappWorkflowCanvasPage", () => {
  it("renders Canvas header, AI Copilot, and simulator trigger button", () => {
    const html = renderToString(<WhatsappWorkflowCanvasPage />)
    expect(html).toContain("Visual Graph")
    expect(html).toContain("AI Copilot:")
    expect(html).toContain("Simulasi Test")
  })

  it("renders node type palette buttons", () => {
    const html = renderToString(<WhatsappWorkflowCanvasPage />)
    expect(html).toContain("Kirim Pesan")
    expect(html).toContain("Tanya Input")
    expect(html).toContain("AI Response")
    expect(html).toContain("If-Else Cabang")
    expect(html).toContain("HTTP Webhook")
    expect(html).toContain("Tombol Pilihan")
  })
})
