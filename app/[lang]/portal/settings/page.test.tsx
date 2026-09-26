import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: PortalSettingsPage } = await import("./page")

describe("PortalSettingsPage", () => {
  it("redirects to /portal/settings/emails", async () => {
    expect(
      PortalSettingsPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/settings/emails")
  })
})
