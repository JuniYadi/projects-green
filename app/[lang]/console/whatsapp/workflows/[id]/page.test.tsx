import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: ConsoleWhatsAppWorkflowDetailPage } = await import("./page")

describe("ConsoleWhatsAppWorkflowDetailPage", () => {
  it("redirects to /console/whatsapp/workflows/[id]/canvas", async () => {
    expect(
      ConsoleWhatsAppWorkflowDetailPage({
        params: Promise.resolve({ lang: "en", id: "wf-123" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console/whatsapp/workflows/wf-123/canvas")
  })
})
