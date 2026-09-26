import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: PortalBillingOrgPage } = await import("./page")

describe("PortalBillingOrgPage", () => {
  it("redirects to /portal/orgs", async () => {
    expect(
      PortalBillingOrgPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/orgs")
  })
})
