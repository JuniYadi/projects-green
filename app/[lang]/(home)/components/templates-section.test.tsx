import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { TemplatesSection } from "./templates-section"

const mockUseParams = mock(() => ({ lang: "id" }))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("TemplatesSection", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders ready templates, upcoming stacks, and comparison table", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText, container } = render(<TemplatesSection />)

    expect(container.querySelector("#templates")).toBeInTheDocument()

    // 3 Ready templates
    expect(getByText("Hermes Agent")).toBeInTheDocument()
    expect(getByText("9router")).toBeInTheDocument()
    expect(getByText("n8n Automation")).toBeInTheDocument()

    // 3 Available Soon stacks
    expect(getByText("OpenClaw")).toBeInTheDocument()
    expect(getByText("OmniRoute")).toBeInTheDocument()
    expect(getByText("WordPress")).toBeInTheDocument()

    // Request card
    expect(
      getByText(/Butuh Docker Image atau Template Aplikasi Lain\?/i)
    ).toBeInTheDocument()

    // Comparison table
    expect(
      getByText(/Kenapa Infrastruktur Kami Lebih Cepat & Anti-Lag\?/i)
    ).toBeInTheDocument()
    expect(
      getByText(/Direct Enterprise NVMe \(400.000 IOPS, Sub-millisecond\)/i)
    ).toBeInTheDocument()
  })
})
