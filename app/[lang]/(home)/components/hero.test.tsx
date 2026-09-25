import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
}))

import { HeroSection } from "./hero"

describe("HeroSection", () => {
  beforeEach(() => {
    cleanup()
    mockUseParams.mockClear()
    mockUseParams.mockReturnValue({ lang: "en" })
  })

  it("leads with App Hosting and one template action in English", () => {
    const { getByRole, queryByText } = render(<HeroSection />)

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Run your apps without setting up a server."
    )
    expect(
      getByRole("link", { name: /Explore ready-to-deploy apps/i })
    ).toHaveAttribute("href", "/en#templates")
    expect(getByRole("link", { name: /Deploy from Git/i })).toHaveAttribute(
      "href",
      "/en/login?next=%2Fen%2Fconsole%2Fapp%2Fdeploy"
    )
    expect(queryByText("Cluster SG-01: Operational")).not.toBeInTheDocument()
  })

  it("shows localized deployment copy and destinations in Indonesian", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText } = render(<HeroSection />)

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Jalankan aplikasi Anda tanpa menyiapkan server."
    )
    expect(getByText("Memori tetap tersimpan")).toBeInTheDocument()
    expect(
      getByRole("link", { name: /Lihat template siap deploy/i })
    ).toHaveAttribute("href", "/id#templates")
  })

  it("slides between available apps and updates the deploy destination", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, queryByRole } = render(<HeroSection />)

    fireEvent.click(getByRole("button", { name: "Aplikasi berikutnya" }))
    expect(getByText("9router.sg.pfnapp.dev")).toBeInTheDocument()
    expect(getByRole("link", { name: "Deploy 9router" })).toHaveAttribute(
      "href",
      "/id/login?next=%2Fid%2Fconsole%2Fapp%2Fmarketplace%3Ftemplate%3D9router"
    )
    expect(
      queryByRole("link", { name: "Deploy Hermes Agent" })
    ).not.toBeInTheDocument()

    fireEvent.click(getByRole("button", { name: "n8n Automation" }))
    expect(getByRole("button", { name: "n8n Automation" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(
      getByRole("link", { name: "Deploy n8n Automation" })
    ).toBeInTheDocument()
  })
})
