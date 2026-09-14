import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: mock(), replace: mock() }),
  useParams: () => ({ lang: "id", slug: "hermes-stellar-star" }),
}))

const { default: ConsoleTerminalRedirectPage } = await import("./page")

describe("ConsoleTerminalRedirectPage", () => {
  it("redirects to standalone /terminal/[slug] route", async () => {
    mockRedirect.mockClear()
    await expect(
      ConsoleTerminalRedirectPage({
        params: Promise.resolve({
          lang: "id",
          slug: "hermes-stellar-star",
        }),
      })
    ).rejects.toThrow("REDIRECT:/id/terminal/hermes-stellar-star")

    expect(mockRedirect).toHaveBeenCalledWith(
      "/id/terminal/hermes-stellar-star"
    )
  })
})
