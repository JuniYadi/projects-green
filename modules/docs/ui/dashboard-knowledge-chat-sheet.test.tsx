import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

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
  it("renders knowledge chat sheet with current route context", () => {
    const view = render(<DashboardKnowledgeChatSheet />)

    expect(view.getByText(/Knowledge Chat/i)).toBeInTheDocument()
    expect(view.getByText("Using current page context:")).toBeInTheDocument()
    expect(view.getByText("/console")).toBeInTheDocument()
    expect(
      view.getByPlaceholderText("Ask from knowledgebase...")
    ).toBeInTheDocument()
  })
})
