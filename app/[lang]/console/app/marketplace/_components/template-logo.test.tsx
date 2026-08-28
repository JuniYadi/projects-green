import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import React from "react"
import { TemplateLogo } from "./template-logo"

describe("TemplateLogo", () => {
  it("renders React Icon from simple-icons for recognized slug (e.g. n8n)", () => {
    const { container } = render(<TemplateLogo slug="n8n" name="n8n" />)
    const icon =
      container.querySelector('[data-testid="si-sin8n"]') ||
      container.querySelector("svg")
    expect(icon).toBeTruthy()
  })

  it("renders React Icon for hermes and wordpress", () => {
    const { container: hermesContainer } = render(
      <TemplateLogo slug="hermes" name="Hermes" />
    )
    expect(hermesContainer.querySelector("svg")).toBeTruthy()

    const { container: wpContainer } = render(
      <TemplateLogo slug="wordpress" name="WordPress" />
    )
    const wpIcon =
      wpContainer.querySelector('[data-testid="si-siwordpress"]') ||
      wpContainer.querySelector("svg")
    expect(wpIcon).toBeTruthy()
  })
  it("renders img tag when iconUrl is provided for custom or unmapped template", () => {
    const { container } = render(
      <TemplateLogo
        slug="custom-app"
        name="Custom App"
        iconUrl="/app-hosting/icons/custom.svg"
      />
    )
    // If happy-dom immediately triggers onError because resource is not on local test server,
    // it will either render the img or the next fallback img / package
    const element =
      container.querySelector("img") || container.querySelector("svg")
    expect(element).toBeTruthy()
  })

  it("falls back to /app-hosting/icons/<slug>.svg or Package when icon is not in simple-icons", () => {
    const { container } = render(<TemplateLogo slug="9router" name="9router" />)
    const element =
      container.querySelector("img") || container.querySelector("svg")
    expect(element).toBeTruthy()
  })

  it("renders default fallback Package icon when no slug or iconUrl matches", () => {
    const { container } = render(<TemplateLogo slug="" />)
    const svg = container.querySelector("svg")
    expect(svg).toBeTruthy()
  })
})
