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

import WhatsAppActionIntentBuilder from "./action-intent-builder"

describe("WhatsAppActionIntentBuilder re-export", () => {
  it("renders correctly from whatsapp module re-export", () => {
    const html = renderToString(
      <WhatsAppActionIntentBuilder agents={[]} lang="id" />
    )
    expect(html).toContain("AI Agent Action Intent Builder")
    expect(html).toContain("Buat Action Intent Baru")
  })
})
