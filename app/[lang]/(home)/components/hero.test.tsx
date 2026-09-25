import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
}))

import { HeroSection } from "./hero"

const promoOffer = { kind: "promo", code: "WELCOME-PFNAI" } as const

describe("HeroSection", () => {
  beforeEach(() => {
    cleanup()
    mockUseParams.mockClear()
    mockUseParams.mockReturnValue({ lang: "en" })
  })

  it("leads with the first-customer Hermes offer in English", () => {
    const { getByRole, queryByText } = render(
      <HeroSection offer={promoOffer} />
    )

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "An AI assistant for the price of a cup of coffee? Really?"
    )
    expect(getByRole("link", { name: "Explore marketplace" })).toHaveAttribute(
      "href",
      "/en/login?next=%2Fen%2Fconsole%2Fapp%2Fmarketplace"
    )
    expect(
      getByRole("link", { name: "Explore other templates" })
    ).toHaveAttribute("href", "/en#templates")
    expect(
      getByRole("heading", { level: 1 }).nextElementSibling
    ).toHaveTextContent("first 15 customers")
    expect(
      getByRole("heading", { level: 1 }).nextElementSibling
    ).toHaveTextContent("including renewals")
    expect(queryByText("Cluster SG-01: Operational")).not.toBeInTheDocument()
  })

  it("shows localized deployment copy and destinations in Indonesian", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, queryByRole } = render(
      <HeroSection offer={promoOffer} />
    )

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "AI Assistance seharga secangkir kopi? Emang bisa?"
    )
    expect(
      getByText("Bantu pecah rencana launching jadi tugas kecil.")
    ).toBeInTheDocument()
    expect(
      getByText("Mulai dari halaman produk, pembayaran, lalu uji coba.")
    ).toBeInTheDocument()
    expect(getByText("Apa yang harus dikerjakan dulu?")).toBeInTheDocument()
    expect(
      getByText("Halaman produk. Tulis manfaat utamanya dulu.")
    ).toBeInTheDocument()
    expect(queryByRole("link", { name: "Deploy" })).not.toBeInTheDocument()
    expect(getByRole("link", { name: "Jelajahi marketplace" })).toHaveAttribute(
      "href",
      "/id/login?next=%2Fid%2Fconsole%2Fapp%2Fmarketplace"
    )
    expect(getByRole("link", { name: "Lihat template lain" })).toHaveAttribute(
      "href",
      "/id#templates"
    )
    const offer = getByText(/Mulai Rp9.900\/bulan untuk 15 pelanggan pertama/)
    expect(offer).toHaveTextContent("harga tetap saat perpanjangan")
    expect(offer).toHaveTextContent("ganti template tanpa langganan baru")
    expect(offer).toHaveTextContent("OpenClaw sedang disiapkan")
    expect(offer.textContent?.match(/Rp9\.900/g)).toHaveLength(1)
  })

  it("slides between available app previews without template deploy links", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, getAllByText, queryByRole } = render(
      <HeroSection offer={promoOffer} />
    )

    fireEvent.click(getByRole("button", { name: "Aplikasi berikutnya" }))
    expect(getByText("GPT-6 Luna")).toBeInTheDocument()
    expect(getByText("1.384")).toBeInTheDocument()
    expect(getByText("839")).toBeInTheDocument()
    expect(getByText("baru")).toBeInTheDocument()
    expect(getByText("Claude Sonnet")).toBeInTheDocument()
    expect(getByText("DeepSeek V3")).toBeInTheDocument()
    expect(getByText("Qwen 3")).toBeInTheDocument()
    expect(queryByRole("link", { name: "Deploy" })).not.toBeInTheDocument()
    fireEvent.click(getByRole("button", { name: "n8n Automation" }))
    expect(getByRole("button", { name: "n8n Automation" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(queryByRole("link", { name: "Deploy" })).not.toBeInTheDocument()
    expect(getAllByText("Email")).toHaveLength(2)
    expect(getByText("Google Drive")).toBeInTheDocument()
    expect(getByText("Calendar")).toBeInTheDocument()
    expect(getByText("Pesanan masuk")).toBeInTheDocument()
    expect(getByText("Kirim konfirmasi")).toBeInTheDocument()
  })

  it("shows normal price when the voucher cannot be claimed", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, queryByText } = render(
      <HeroSection offer={{ kind: "standard", monthlyPriceIdr: "29000" }} />
    )

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Jalankan AI assistant Anda tanpa mengurus server."
    )
    expect(
      getByText(/Paket Starter mulai Rp\s?29.000\/bulan/)
    ).toBeInTheDocument()
    expect(getByRole("link", { name: "Jelajahi marketplace" })).toHaveAttribute(
      "href",
      "/id/login?next=%2Fid%2Fconsole%2Fapp%2Fmarketplace"
    )
    expect(queryByText(/15 pelanggan pertama/)).not.toBeInTheDocument()
    expect(queryByText(/secangkir kopi/)).not.toBeInTheDocument()
  })

  it("does not invent a normal price when pricing is unavailable", () => {
    const { getByRole, queryByText } = render(
      <HeroSection offer={{ kind: "standard", monthlyPriceIdr: null }} />
    )
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Run your AI assistant without managing a server."
    )
    expect(queryByText(/Starter plans from/)).not.toBeInTheDocument()
    expect(queryByText(/Regular pricing applies/)).toBeInTheDocument()
    expect(
      getByRole("link", { name: "Explore marketplace" })
    ).toBeInTheDocument()
  })
})
