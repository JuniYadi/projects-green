import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
}))

import { HeroSection } from "./hero"

const offer = { monthlyPriceIdr: null } as const

describe("HeroSection", () => {
  beforeEach(() => {
    cleanup()
    mockUseParams.mockClear()
    mockUseParams.mockReturnValue({ lang: "en" })
  })

  it("leads with Hermes without promising an unavailable promotion", () => {
    const { getByRole, queryByText } = render(<HeroSection offer={offer} />)

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Run your AI assistant without managing a server."
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
    ).toHaveTextContent("See available plans in the console.")
    expect(
      queryByText(/first 15 customers|including renewals|Rp9,900/)
    ).not.toBeInTheDocument()
    expect(queryByText("Cluster SG-01: Operational")).not.toBeInTheDocument()
  })

  it("shows localized deployment copy and destinations in Indonesian", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, queryByRole } = render(
      <HeroSection offer={offer} />
    )

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Jalankan AI assistant Anda tanpa mengurus server."
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
    const description = getByText(/Lihat paket yang tersedia di konsol/)
    expect(description).toHaveTextContent("ganti template tanpa langganan baru")
    expect(description).toHaveTextContent("OpenClaw sedang disiapkan")
    expect(description).not.toHaveTextContent(
      /Rp9\.900|15 pelanggan|perpanjangan/
    )
  })

  it("slides between available app previews without template deploy links", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, getAllByText, queryByRole } = render(
      <HeroSection offer={offer} />
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

  it("shows live Starter pricing when available", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByRole, getByText, queryByText } = render(
      <HeroSection offer={{ monthlyPriceIdr: "29000" }} />
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
      <HeroSection offer={{ monthlyPriceIdr: null }} />
    )
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Run your AI assistant without managing a server."
    )
    expect(queryByText(/Starter plans from/)).not.toBeInTheDocument()
    expect(
      queryByText(/See available plans in the console/)
    ).toBeInTheDocument()
    expect(
      getByRole("link", { name: "Explore marketplace" })
    ).toBeInTheDocument()
  })
})
