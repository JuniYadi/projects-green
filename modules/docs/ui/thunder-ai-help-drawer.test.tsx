import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { act } from "react"

const mockReplace = mock(() => {})

describe("ThunderAiHelpDrawer", () => {
  beforeEach(() => {
    mock.restore()
  })

  it("renders Thunder AI Chat when kb=1 is set", async () => {
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

    const { ThunderAiHelpDrawer } = await import("./thunder-ai-help-drawer")

    let view: ReturnType<typeof render> | undefined

    await act(async () => {
      view = render(<ThunderAiHelpDrawer />)
    })

    expect(
      view!.getByRole("heading", { name: "Thunder AI Help" })
    ).toBeTruthy()
    expect(
      view!.getByText("Thunder AI Assistant")
    ).toBeTruthy()
    expect(
      view!.getByPlaceholderText("Ask about this page or system workflows...")
    ).toBeTruthy()
  })

  it("renders Page Guides when doc=1 is set", async () => {
    mock.module("next/navigation", () => ({
      useRouter: () => ({
        replace: mockReplace,
      }),
      usePathname: () => "/en/console",
      useSearchParams: () => new URLSearchParams("doc=1"),
    }))

    mock.module("next/navigation.js", () => ({
      useRouter: () => ({
        replace: mockReplace,
      }),
      usePathname: () => "/en/console",
      useSearchParams: () => new URLSearchParams("doc=1"),
    }))

    const { ThunderAiHelpDrawer } = await import("./thunder-ai-help-drawer")

    let view: ReturnType<typeof render> | undefined

    await act(async () => {
      view = render(<ThunderAiHelpDrawer />)
    })

    expect(
      view!.getByRole("heading", { name: "Thunder AI Help" })
    ).toBeTruthy()
    expect(
      view!.getByText("Page Guides")
    ).toBeTruthy()
  })
})
