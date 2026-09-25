import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
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

  it("renders the terminal title bar and interactive template selector pills", () => {
    mockUseParams.mockReturnValue({ lang: "en" })
    const { getByText, getByRole } = render(<HeroSection />)

    expect(getByText("PFNApp Hosting - Deployment")).toBeInTheDocument()
    expect(getByText("Select template:")).toBeInTheDocument()

    const hermesBtn = getByRole("button", { name: "{hermes}" })
    const routerBtn = getByRole("button", { name: "{9router}" })
    const openclawBtn = getByRole("button", { name: "{openclaw}" })
    const n8nBtn = getByRole("button", { name: "{n8n}" })

    expect(hermesBtn).toBeInTheDocument()
    expect(routerBtn).toBeInTheDocument()
    expect(openclawBtn).toBeInTheDocument()
    expect(n8nBtn).toBeInTheDocument()

    expect(hermesBtn).toHaveAttribute("aria-pressed", "true")
    expect(routerBtn).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(routerBtn)
    expect(routerBtn).toHaveAttribute("aria-pressed", "true")
    expect(hermesBtn).toHaveAttribute("aria-pressed", "false")
  })
})
