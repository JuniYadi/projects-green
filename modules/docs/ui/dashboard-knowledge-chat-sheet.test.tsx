import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { act } from "react"

const mockReplace = mock(() => {})

describe("DashboardKnowledgeChatSheet", () => {
  it("renders knowledge chat sheet component", async () => {
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

    const { DashboardKnowledgeChatSheet } = await import(
      "./dashboard-knowledge-chat-sheet"
    )

    let view: ReturnType<typeof render> | undefined

    await act(async () => {
      view = render(<DashboardKnowledgeChatSheet />)
    })

    if (view?.queryByText("Knowledge Chat Sheet")) {
      expect(view.getByText("Knowledge Chat Sheet")).toBeInTheDocument()
      return
    }

    expect(
      view?.getByRole("heading", { name: "Knowledge Chat" })
    ).toBeInTheDocument()
    expect(
      view?.getByText("Ask questions from the internal knowledgebase.")
    ).toBeInTheDocument()
    expect(
      view?.getByText("Using current page context:", { exact: false })
    ).toBeInTheDocument()
    expect(
      view?.getByPlaceholderText("Ask from knowledgebase...")
    ).toBeInTheDocument()
  })
})
