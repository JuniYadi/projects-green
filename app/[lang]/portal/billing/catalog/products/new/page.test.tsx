import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import ProductChoicePage from "./page"

describe("ProductChoicePage", () => {
  it("renders each product choice with a canonical localized new-product link", () => {
    const view = render(<ProductChoicePage />)

    expect(
      view.getByRole("heading", { name: "Choose a product" })
    ).toBeInTheDocument()
    expect(view.getByRole("link", { name: "App Hosting" })).toHaveAttribute(
      "href",
      "/en/portal/billing/catalog/APP_HOSTING?new=true"
    )
    expect(view.getByRole("link", { name: "VPN" })).toHaveAttribute(
      "href",
      "/en/portal/billing/catalog/VPN?new=true"
    )
    expect(view.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "/en/portal/billing/catalog/WHATSAPP?new=true"
    )
  })
})
