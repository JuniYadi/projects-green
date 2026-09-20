import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { HeroSection } from "./hero"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("HeroSection", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders the hero heading, stats, and call-to-actions in English", () => {
    mockUseParams.mockReturnValue({ lang: "en" })
    const { getByRole, getByText } = render(<HeroSection />)

    expect(getByRole("heading", { level: 1 })).toBeInTheDocument()

    // Assert key stat values and CTAs
    expect(getByText("99.9%")).toBeInTheDocument()
    expect(getByText("< 2s")).toBeInTheDocument()
    expect(getByText("24/7")).toBeInTheDocument()
    expect(getByText("100%")).toBeInTheDocument()

    const exploreCta = getByRole("link", { name: /Explore WhatsApp Platform/i })
    expect(exploreCta).toHaveAttribute("href", "/en/products/whatsapp-official")

    const consoleCta = getByRole("link", { name: /Open Console/i })
    expect(consoleCta).toHaveAttribute("href", "/en/login")
  })

  it("renders Indonesian copy and localized links when active", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText } = render(<HeroSection />)

    expect(getByText("Latensi Kirim Pesan")).toBeInTheDocument()
    expect(getByText("Dukungan Teknis")).toBeInTheDocument()
    expect(getByText("API Resmi Meta")).toBeInTheDocument()

    const exploreCta = getByRole("link", { name: /Lihat Solusi WhatsApp/i })
    expect(exploreCta).toHaveAttribute("href", "/id/products/whatsapp-official")

    const consoleCta = getByRole("link", { name: /Buka Konsol/i })
    expect(consoleCta).toHaveAttribute("href", "/id/login")
  })
})
