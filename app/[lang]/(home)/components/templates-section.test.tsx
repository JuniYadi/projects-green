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

  it("renders available templates with deploy destinations", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText, container } = render(<TemplatesSection />)

    expect(container.querySelector("#templates")).toBeInTheDocument()

    // 3 Ready templates
    expect(getByText("Hermes Agent")).toBeInTheDocument()
    expect(getByText("9router")).toBeInTheDocument()
    expect(getByText("n8n Automation")).toBeInTheDocument()

    expect(
      getByText("Pilih aplikasi yang ingin dijalankan")
    ).toBeInTheDocument()

    // Deploy links with target template intent
    const hermesDeployLink = container.querySelector(
      'a[href*="template%3Dhermes"]'
    )
    expect(hermesDeployLink).not.toBeNull()
    expect(hermesDeployLink).toHaveAttribute(
      "href",
      "/id/login?next=%2Fid%2Fconsole%2Fapp%2Fmarketplace%3Ftemplate%3Dhermes"
    )

    // Request template email link
    const requestLink = container.querySelector(
      'a[href^="mailto:support@pfnapp.com"]'
    )
    expect(requestLink).not.toBeNull()
  })
})
