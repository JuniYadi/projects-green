import { describe, expect, it, mock } from "bun:test"

import { createNavigationMock } from "@/test/layout-test-mocks"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => {
  return createNavigationMock({
    pathname: "/portal",
    redirect: mockRedirect,
  })
})

describe("PortalPage", () => {
  it("redirects portal root to the portal documentation surface", async () => {
    const pageModule = await import("@/app/portal/page")

    expect(() => pageModule.default()).toThrow(
      "REDIRECT:/portal/documentations"
    )
    expect(mockRedirect).toHaveBeenCalledWith("/portal/documentations")
  })
})
