import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: PortalSystemPage } = await import("./page")

describe("PortalSystemPage", () => {
  it("redirects to /portal/system/cronjobs", async () => {
    expect(
      PortalSystemPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/system/cronjobs")
  })
})
