import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { Footer } from "./footer"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("Public Footer Component", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders legal navigation with locale-aware routes for Terms, Privacy, and AUP", () => {
    mockUseParams.mockReturnValue({ lang: "en" })
    const view = render(<Footer />)

    const termsLink = view.getByRole("link", { name: "Terms of Service" })
    const privacyLink = view.getByRole("link", { name: "Privacy Policy" })
    const aupLink = view.getByRole("link", {
      name: "Acceptable Use Policy",
    })

    expect(termsLink).toBeInTheDocument()
    expect(termsLink.getAttribute("href")).toBe("/en/terms")

    expect(privacyLink).toBeInTheDocument()
    expect(privacyLink.getAttribute("href")).toBe("/en/privacy")

    expect(aupLink).toBeInTheDocument()
    expect(aupLink.getAttribute("href")).toBe("/en/acceptable-use")
  })

  it("adjusts legal links when Indonesian locale is active", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const view = render(<Footer />)

    const termsLink = view.getByRole("link", { name: "Terms of Service" })
    const privacyLink = view.getByRole("link", { name: "Privacy Policy" })
    const aupLink = view.getByRole("link", {
      name: "Acceptable Use Policy",
    })

    expect(termsLink.getAttribute("href")).toBe("/id/terms")
    expect(privacyLink.getAttribute("href")).toBe("/id/privacy")
    expect(aupLink.getAttribute("href")).toBe("/id/acceptable-use")
  })
})
