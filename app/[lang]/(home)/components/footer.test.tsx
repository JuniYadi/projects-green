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
    expect(
      view.getByText(
        "Big ideas need more than a plan. Build and grow with PFNApp."
      )
    ).toBeInTheDocument()
  })

  it("adjusts legal links when Indonesian locale is active", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const view = render(<Footer />)

    const termsLink = view.getByRole("link", { name: "Ketentuan Layanan" })
    const privacyLink = view.getByRole("link", { name: "Kebijakan Privasi" })
    const aupLink = view.getByRole("link", {
      name: "Kebijakan Penggunaan Wajar",
    })

    expect(termsLink.getAttribute("href")).toBe("/id/terms")
    expect(privacyLink.getAttribute("href")).toBe("/id/privacy")
    expect(aupLink.getAttribute("href")).toBe("/id/acceptable-use")
    expect(view.getByRole("link", { name: "Why Us" })).toHaveAttribute(
      "href",
      "/id#why-us"
    )
    expect(view.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/id#templates"
    )
    expect(
      view.getByText(
        "Ide besar perlu lebih dari rencana. Bangun dan kembangkan bersama PFNApp."
      )
    ).toBeInTheDocument()
    expect(view.getByRole("link", { name: "PFNApp" })).toHaveTextContent(
      "PFNApp"
    )
  })
})
