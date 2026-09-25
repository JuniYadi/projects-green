import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PricingSection } from "./pricing"

const mockUseParams = mock(() => ({ lang: "id" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("PricingSection", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders the 4 IDR tiers with launch voucher announcement", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText, container } = render(<PricingSection />)

    expect(container.querySelector("#pricing")).toBeInTheDocument()

    // Voucher announcement
    expect(getByText(/Promo Peluncuran Batch 1/i)).toBeInTheDocument()
    expect(getByText(/Voucher Saldo Rp 50.000/i)).toBeInTheDocument()

    // 4 Plans
    expect(getByText("Starter")).toBeInTheDocument()
    expect(getByText("Pro")).toBeInTheDocument()
    expect(getByText("Business Dedicated")).toBeInTheDocument()
    expect(getByText("Enterprise Dedicated")).toBeInTheDocument()

    // Currency values
    expect(getByText("Rp 29.000")).toBeInTheDocument()
    expect(getByText("Rp 69.000")).toBeInTheDocument()
    expect(getByText("Rp 189.000")).toBeInTheDocument()
    expect(getByText("Rp 349.000")).toBeInTheDocument()

    // Payment methods
    expect(getByText(/Metode Pembayaran Lokal Resmi/i)).toBeInTheDocument()
    expect(getByText(/QRIS/i)).toBeInTheDocument()
  })

  it("toggles between monthly and yearly billing", async () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText } = render(<PricingSection />)
    const user = userEvent.setup()

    const yearlyButton = getByText(/Tahunan/i)
    await user.click(yearlyButton)

    // Starter yearly price is Rp 20.000
    expect(getByText("Rp 20.000")).toBeInTheDocument()
    // Pro yearly price is Rp 55.000
    expect(getByText("Rp 55.000")).toBeInTheDocument()
  })
})
