import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { TestimonialsSection } from "./testimonials"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("TestimonialsSection", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders reliability pillars section with key metrics in English", () => {
    mockUseParams.mockReturnValue({ lang: "en" })
    const { getByRole, getByText } = render(<TestimonialsSection />)

    expect(getByRole("heading", { level: 2 })).toBeInTheDocument()
    expect(getByText("Platform Reliability Standards")).toBeInTheDocument()
    expect(getByText("Official WhatsApp Platform")).toBeInTheDocument()
    expect(getByText("AES-256")).toBeInTheDocument()
    expect(getByText("QRIS")).toBeInTheDocument()
  })

  it("renders Indonesian copy and metric labels when active", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText } = render(<TestimonialsSection />)

    expect(getByText("Standar Keandalan Platform")).toBeInTheDocument()
    expect(getByText("Integrasi WhatsApp Resmi")).toBeInTheDocument()
    expect(getByText("Keamanan Data & Privasi")).toBeInTheDocument()
    expect(getByText("Ketersediaan Layanan")).toBeInTheDocument()
    expect(getByText("Instan & Tanpa Biaya Tersembunyi")).toBeInTheDocument()
  })
})
