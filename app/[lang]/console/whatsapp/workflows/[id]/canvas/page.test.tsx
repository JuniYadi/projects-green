import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((_dest: string) => {})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

import WhatsappWorkflowCanvasRedirectPage from "./page"

describe("WhatsappWorkflowCanvasRedirectPage", () => {
  it("redirects to canonical AI Studio agent canvas route", async () => {
    await WhatsappWorkflowCanvasRedirectPage({
      params: Promise.resolve({ lang: "en", id: "wf_123" }),
      searchParams: Promise.resolve({ template: "template_order" }),
    })

    expect(mockRedirect).toHaveBeenCalledWith(
      "/en/console/ai/agents/wf_123/canvas?template=template_order"
    )
  })

  it("redirects cleanly when searchParams are not provided", async () => {
    await WhatsappWorkflowCanvasRedirectPage({
      params: Promise.resolve({ lang: "id", id: "new" }),
    })

    expect(mockRedirect).toHaveBeenCalledWith(
      "/id/console/ai/agents/new/canvas"
    )
  })
})
