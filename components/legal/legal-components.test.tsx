import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { LegalPageLayout } from "./legal-page-layout"
import { LegalDocumentView } from "./legal-document-view"

describe("LegalPageLayout Component", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders navigation items, brand logo, and active indicator for terms", () => {
    const view = render(
      <LegalPageLayout locale="en" activeDoc="terms">
        <div data-testid="legal-content">Terms Content</div>
      </LegalPageLayout>
    )

    expect(view.getByText("Terms Content")).toBeInTheDocument()
    expect(view.getByText("Legal Center")).toBeInTheDocument()
    expect(view.getByText("Policies & Agreements")).toBeInTheDocument()
    expect(view.getByText("Entity:")).toBeInTheDocument()
    expect(view.getByText("Contact:")).toBeInTheDocument()
    expect(
      view.getAllByText("PT. Premium Fast Network").length
    ).toBeGreaterThan(0)
    expect(view.getAllByText("support@premiumfast.net").length).toBeGreaterThan(
      0
    )
    const sidebarNav = view.getByRole("navigation", {
      name: "Legal document navigation",
    })
    const termsLink = within(sidebarNav).getByRole("link", {
      name: "Terms of Service",
    })
    expect(termsLink.getAttribute("aria-current")).toBe("page")
    expect(termsLink.getAttribute("href")).toBe("/en/terms")

    const privacyLink = within(sidebarNav).getByRole("link", {
      name: "Privacy Policy",
    })
    expect(privacyLink.getAttribute("aria-current")).toBeNull()
    expect(privacyLink.getAttribute("href")).toBe("/en/privacy")

    const aupLink = within(sidebarNav).getByRole("link", {
      name: "Acceptable Use Policy",
    })
    expect(aupLink.getAttribute("aria-current")).toBeNull()
    expect(aupLink.getAttribute("href")).toBe("/en/acceptable-use")

    const localeSwitchLink = view.getByRole("link", {
      name: /Bahasa Indonesia/i,
    })
    expect(localeSwitchLink.getAttribute("href")).toBe("/id/terms")
  })

  it("renders Indonesian layout and active indicator for privacy", () => {
    const view = render(
      <LegalPageLayout locale="id" activeDoc="privacy">
        <div data-testid="legal-content">Konten Privasi</div>
      </LegalPageLayout>
    )
    expect(view.getByText("Konten Privasi")).toBeInTheDocument()
    expect(view.getByText("Pusat Hukum")).toBeInTheDocument()
    expect(view.getByText("Kebijakan & Perjanjian")).toBeInTheDocument()
    expect(view.getByText("Entitas:")).toBeInTheDocument()
    expect(view.getByText("Kontak:")).toBeInTheDocument()
    const sidebarNav = view.getByRole("navigation", {
      name: "Legal document navigation",
    })
    const privacyLink = within(sidebarNav).getByRole("link", {
      name: "Kebijakan Privasi",
    })
    expect(privacyLink.getAttribute("aria-current")).toBe("page")
    expect(privacyLink.getAttribute("href")).toBe("/id/privacy")

    const localeSwitchLink = view.getByRole("link", {
      name: /English/i,
    })
    expect(localeSwitchLink.getAttribute("href")).toBe("/en/privacy")
  })
})

describe("LegalDocumentView Component", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders Terms document sections and headings in English", () => {
    const view = render(<LegalDocumentView locale="en" docKey="terms" />)

    expect(
      view.getByRole("heading", { level: 1, name: "Terms of Service" })
    ).toBeInTheDocument()
    expect(view.getByText("Official Legal Policy")).toBeInTheDocument()
    expect(view.getByText("1. Acceptance of Terms")).toBeInTheDocument()
    expect(
      view.getAllByText("PT. Premium Fast Network", { exact: false }).length
    ).toBeGreaterThan(0)
  })

  it("renders Privacy document sections in Indonesian", () => {
    const view = render(<LegalDocumentView locale="id" docKey="privacy" />)

    expect(
      view.getByRole("heading", { level: 1, name: "Kebijakan Privasi" })
    ).toBeInTheDocument()
    expect(view.getByText("Kebijakan Hukum Resmi")).toBeInTheDocument()
    expect(
      view.getByText("1. Informasi yang Kami Kumpulkan")
    ).toBeInTheDocument()
  })

  it("renders Acceptable Use document sections in English", () => {
    const view = render(
      <LegalDocumentView locale="en" docKey="acceptable-use" />
    )

    expect(
      view.getByRole("heading", { level: 1, name: "Acceptable Use Policy" })
    ).toBeInTheDocument()
    expect(view.getByText("Official Legal Policy")).toBeInTheDocument()
    expect(view.getByText("1. Purpose & Scope")).toBeInTheDocument()
  })
})
