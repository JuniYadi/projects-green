import { describe, expect, it, mock } from "bun:test"
import { renderToString } from "react-dom/server"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mock(() => {}) }),
}))

import WhatsappWorkflowsPage from "./page"

describe("WhatsappWorkflowsPage", () => {
  it("renders AI & Bot Workflows heading and action buttons", () => {
    const html = renderToString(<WhatsappWorkflowsPage />)
    expect(html).toContain("AI &amp; Bot Workflows")
    expect(html).toContain("Buat Alur Canvas Baru")
  })
})
