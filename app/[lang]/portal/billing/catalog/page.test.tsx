import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import CatalogPage from "./page"

describe("PortalBillingCatalogPage", () => {
  it("links Create product to the localized product choice route", () => {
    const view = render(<CatalogPage />)

    expect(view.getByRole("link", { name: "Create product" })).toHaveAttribute(
      "href",
      "/en/portal/billing/catalog/products/new"
    )
  })
})
