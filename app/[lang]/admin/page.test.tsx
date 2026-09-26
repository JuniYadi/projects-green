import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: AdminRootPage } = await import("./page")

describe("AdminRootPage", () => {
  it("redirects to /portal/admin", async () => {
    expect(
      AdminRootPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/admin")
  })
})
