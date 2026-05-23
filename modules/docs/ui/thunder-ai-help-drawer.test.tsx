import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import { act } from "react"

import { ThunderAiHelpDrawer } from "@/modules/docs/ui/thunder-ai-help-drawer"

const mockReplace = mock(() => {})

function setupNavigationMock(searchParamsString: string) {
  const navigationMockImpl = () => ({
    useRouter: () => ({
      replace: mockReplace,
    }),
    usePathname: () => "/en/console",
    useSearchParams: () => new URLSearchParams(searchParamsString),
  })

  mock.module("next/navigation", navigationMockImpl)
  mock.module("next/navigation.js", navigationMockImpl)
}

describe("ThunderAiHelpDrawer", () => {
  beforeEach(() => {
    mock.restore()
  })

  it("renders Thunder AI Chat when kb=1 is set", async () => {
    setupNavigationMock("kb=1")

    let view: ReturnType<typeof render> | undefined

    await act(async () => {
      view = render(<ThunderAiHelpDrawer />)
    })

    expect(
      view!.getByRole("heading", { name: "Thunder AI Help" })
    ).toBeInTheDocument()
    expect(
      view!.getByText("Thunder AI Assistant")
    ).toBeInTheDocument()
    expect(
      view!.getByPlaceholderText("Ask about this page or system workflows...")
    ).toBeInTheDocument()
  })

  it("renders Page Guides when doc=1 is set", async () => {
    setupNavigationMock("doc=1")

    let view: ReturnType<typeof render> | undefined

    await act(async () => {
      view = render(<ThunderAiHelpDrawer />)
    })

    expect(
      view!.getByRole("heading", { name: "Thunder AI Help" })
    ).toBeInTheDocument()
    expect(
      view!.getByText("Page Guides")
    ).toBeInTheDocument()
  })
})
