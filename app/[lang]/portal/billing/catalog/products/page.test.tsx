import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: PortalBillingCatalogProductsPage } = await import("./page")

describe("PortalBillingCatalogProductsPage", () => {
  it("redirects to /portal/billing/catalog", async () => {
    expect(
      PortalBillingCatalogProductsPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal/billing/catalog")
  })
})
