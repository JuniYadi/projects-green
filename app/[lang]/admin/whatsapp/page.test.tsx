import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: AdminWhatsAppPage } = await import("./page")

describe("AdminWhatsAppPage", () => {
  it("redirects to /portal/whatsapp/devices", async () => {
    expect(
      AdminWhatsAppPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/whatsapp/devices")
  })
})
