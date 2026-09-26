import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: ConsoleAppPlatformPage } = await import("./page")

describe("ConsoleAppPlatformPage", () => {
  it("redirects to /console/app/platforms", async () => {
    expect(
      ConsoleAppPlatformPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console/app/platforms")
  })
})
