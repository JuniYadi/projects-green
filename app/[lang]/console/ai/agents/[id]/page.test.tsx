import { describe, expect, it, mock } from "bun:test"

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

const { default: ConsoleAiAgentDetailPage } = await import("./page")

describe("ConsoleAiAgentDetailPage", () => {
  it("redirects to /console/ai/agents/[id]/canvas", async () => {
    expect(
      ConsoleAiAgentDetailPage({
        params: Promise.resolve({ lang: "en", id: "agent-123" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console/ai/agents/agent-123/canvas")
  })
})
