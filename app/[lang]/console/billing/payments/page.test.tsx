import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: ConsoleBillingPaymentsPage } = await import("./page")

describe("ConsoleBillingPaymentsPage", () => {
  it("redirects to /console/billing", async () => {
    expect(
      ConsoleBillingPaymentsPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console/billing")
  })
})
