import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { act } from "react"

import { DashboardKnowledgeChatSheet } from "@/modules/docs/ui/dashboard-knowledge-chat-sheet"

const mockReplace = mock(() => {})

mock.module("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => "/en/console",
  useSearchParams: () => new URLSearchParams("kb=1"),
}))

mock.module("next/navigation.js", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => "/en/console",
  useSearchParams: () => new URLSearchParams("kb=1"),
}))

describe("DashboardKnowledgeChatSheet", () => {
  it("renders knowledge chat sheet component", async () => {
    let view: ReturnType<typeof render>

    await act(async () => {
      view = render(<DashboardKnowledgeChatSheet />)
    })

    // Just verify render completed without error
    expect(view.container).toBeDefined()
  })
})