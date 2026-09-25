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

  it("renders templates without unavailable template destinations", () => {
    mockUseParams.mockReturnValue({ lang: "id" })
    const { getByText, container } = render(<TemplatesSection />)

    expect(container.querySelector("#templates")).toBeInTheDocument()

    expect(getByText("Hermes Agent")).toBeInTheDocument()
    expect(getByText("9router")).toBeInTheDocument()
    expect(getByText("n8n Automation")).toBeInTheDocument()
    expect(getByText("OpenClaw")).toBeInTheDocument()
    expect(getByText("OmniRoute")).toBeInTheDocument()
    expect(getByText("WordPress")).toBeInTheDocument()

    expect(
      getByText("Pilih aplikasi yang ingin dijalankan")
    ).toBeInTheDocument()

    // Available templates link to deploy page with template param
    const hermesLink = container.querySelector(
      'a[href*="deploy%3Ftemplate%3Dhermes"]'
    )
    expect(hermesLink).toBeInTheDocument()
    expect(hermesLink).toHaveAttribute(
      "href",
      "/id/login?next=%2Fid%2Fconsole%2Fapp%2Fdeploy%3Ftemplate%3Dhermes"
    )

    const n8nLink = container.querySelector(
      'a[href*="deploy%3Ftemplate%3Dn8n"]'
    )
    expect(n8nLink).toBeInTheDocument()

    const routerLink = container.querySelector(
      'a[href*="deploy%3Ftemplate%3D9router"]'
    )
    expect(routerLink).toBeInTheDocument()

    // 3 available templates + 1 support ticket link = 4 total links
    expect(container.querySelectorAll("a")).toHaveLength(4)
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(
      container.querySelector('a[href*="support-tickets%2Fnew"]')
    ).toHaveAttribute(
      "href",
      "/id/login?next=%2Fid%2Fconsole%2Fsupport-tickets%2Fnew"
    )
  })
})
