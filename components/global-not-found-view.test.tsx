import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { fireEvent, render } from "@testing-library/react"

const mockRouter = { back: mock(), push: mock() }
let currentPathname = "/en/unknown-page"

mock.module("next/navigation", () => ({
  useRouter: mock(() => mockRouter),
  usePathname: mock(() => currentPathname),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

import { GlobalNotFoundView } from "@/components/global-not-found-view"

describe("GlobalNotFoundView", () => {
  it("renders 404 heading and public actions for standard missing page", () => {
    currentPathname = "/en/unknown-page"
    const { getByRole, getByText } = render(<GlobalNotFoundView />)

    expect(getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(getByText("404 Not Found")).toBeInTheDocument()
    expect(getByRole("link", { name: "Home" })).toHaveAttribute("href", "/en")
    expect(getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "/en/docs"
    )
  })

  it("renders Indonesian copy when forcedLocale or id path is used", () => {
    currentPathname = "/id/tidak-ada"
    const { getByRole, getByText } = render(
      <GlobalNotFoundView forcedLocale="id" />
    )

    expect(
      getByRole("heading", { name: "Halaman tidak ditemukan" })
    ).toBeInTheDocument()
    expect(getByText("404 Tidak Ditemukan")).toBeInTheDocument()
    expect(getByRole("link", { name: "Beranda" })).toHaveAttribute(
      "href",
      "/id"
    )
  })

  it("adapts primary CTA when path is within console area", () => {
    currentPathname = "/en/console/apps/unknown"
    const { getByRole } = render(<GlobalNotFoundView />)

    const consoleLink = getByRole("link", { name: "Return to Console" })
    expect(consoleLink).toHaveAttribute("href", "/en/console")
  })

  it("adapts primary CTA when path is within portal area", () => {
    currentPathname = "/en/portal/missing-section"
    const { getByRole } = render(<GlobalNotFoundView />)

    const portalLink = getByRole("link", { name: "Return to Portal" })
    expect(portalLink).toHaveAttribute("href", "/en/portal")
  })

  it("handles go back action", () => {
    currentPathname = "/en/unknown-page"
    const { getByRole } = render(<GlobalNotFoundView />)

    const backButton = getByRole("button", { name: /Go back/i })
    fireEvent.click(backButton)
    expect(mockRouter.push).toHaveBeenCalledWith("/en")
  })
})
