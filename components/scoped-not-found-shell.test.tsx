import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

const mockRouter = { back: mock(), push: mock() }

mock.module("next/navigation", () => ({
  useRouter: mock(() => mockRouter),
  usePathname: mock(() => "/en/portal/missing"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

import { ScopedNotFoundShell } from "@/components/scoped-not-found-shell"

describe("ScopedNotFoundShell", () => {
  it("renders portal shell with heading, go back button, and return link", () => {
    const { getByRole, getByText } = render(
      <ScopedNotFoundShell surface="portal" fallbackPath="/portal" />
    )

    expect(getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(
      getByText("This portal page does not exist or is no longer available.")
    ).toBeInTheDocument()
    expect(getByRole("button", { name: "Go back" })).toBeInTheDocument()
    const returnLink = getByRole("link", { name: "Return to portal" })
    expect(returnLink).toHaveAttribute("href", "/en/portal")
  })

  it("renders console shell with correct fallback href", () => {
    const { getByRole } = render(
      <ScopedNotFoundShell surface="console" fallbackPath="/console" />
    )

    expect(getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    const returnLink = getByRole("link", { name: "Return to console" })
    expect(returnLink).toHaveAttribute("href", "/en/console")
  })

  it("go back button calls router.back when history.length > 1", () => {
    // Simulate history.length > 1 so router.back() is called instead of push
    Object.defineProperty(window, "history", {
      value: { ...window.history, length: 2 },
      writable: true,
    })
    const { getByRole } = render(
      <ScopedNotFoundShell surface="portal" fallbackPath="/portal" />
    )

    getByRole("button", { name: "Go back" }).click()
    expect(mockRouter.back).toHaveBeenCalled()
  })
})
