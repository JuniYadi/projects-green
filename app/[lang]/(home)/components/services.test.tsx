import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { ServicesSection } from "./services"

const mockUseParams = mock(() => ({ lang: "en" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("ServicesSection", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders services list with key service anchors in English", () => {
    mockUseParams.mockReturnValue({ lang: "en" })
    const { container, getByText } = render(<ServicesSection />)

    expect(container.querySelector("#services")).toBeInTheDocument()
    expect(container.querySelector("#hosting")).toBeInTheDocument()
    expect(container.querySelector("#whatsapp")).toBeInTheDocument()
    expect(container.querySelector("#vpn")).toBeInTheDocument()
    expect(container.querySelector("#storage")).toBeInTheDocument()

    expect(getByText("WhatsApp Official API")).toBeInTheDocument()
    expect(getByText("WireGuard VPN")).toBeInTheDocument()
    expect(getByText("More from PFNApp")).toBeInTheDocument()
  })

  it("renders Indonesian copy and titles when active", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText } = render(<ServicesSection />)

    expect(getByText("Layanan lain di PFNApp")).toBeInTheDocument()
    expect(getByText("Hosting Aplikasi")).toBeInTheDocument()
    expect(getByText("Penyimpanan S3")).toBeInTheDocument()
  })
})
