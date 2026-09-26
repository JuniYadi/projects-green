import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: PortalAppEventsPage } = await import("./page")

describe("PortalAppEventsPage", () => {
  it("redirects to /portal/app/events/github", async () => {
    expect(
      PortalAppEventsPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/app/events/github")
  })
})
