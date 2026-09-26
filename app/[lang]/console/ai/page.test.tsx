import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: ConsoleAiPage } = await import("./page")

describe("ConsoleAiPage", () => {
  it("redirects to /console/ai/agents", async () => {
    expect(
      ConsoleAiPage({
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console/ai/agents")
  })
})
