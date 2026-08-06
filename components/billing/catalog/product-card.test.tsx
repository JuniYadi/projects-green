import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { CatalogProductCard } from "./product-card"
import type { CatalogProduct } from "@/lib/billing-client"

describe("CatalogProductCard", () => {
  const whatsappProduct: CatalogProduct = {
    code: "WHATSAPP",
    name: "WhatsApp",
    description: "WhatsApp Business messaging",
    plans: [],
  }

  const vpnProduct: CatalogProduct = {
    code: "VPN",
    name: "VPN",
    description: "Virtual Private Network",
    plans: [],
  }

  const appHostingProduct: CatalogProduct = {
    code: "APP_HOSTING",
    name: "App Hosting",
    description: "Application hosting platform",
    plans: [],
  }

  it("renders WhatsApp product with WhatsApp icon", () => {
    const view = render(<CatalogProductCard product={whatsappProduct} />)
    expect(view.getByText("WhatsApp")).toBeInTheDocument()
    expect(view.getByText("WhatsApp Business messaging")).toBeInTheDocument()
  })

  it("renders VPN product with GlobeIcon", () => {
    const view = render(<CatalogProductCard product={vpnProduct} />)
    expect(view.getByText("VPN")).toBeInTheDocument()
    expect(view.getByText("Virtual Private Network")).toBeInTheDocument()
  })

  it("renders App Hosting product with RocketLaunchIcon", () => {
    const view = render(<CatalogProductCard product={appHostingProduct} />)
    expect(view.getByText("App Hosting")).toBeInTheDocument()
  })

  it("renders a link to the product plans page", () => {
    const view = render(<CatalogProductCard product={whatsappProduct} />)
    const link = view.getByText("View plans")
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/console/billing/services/whatsapp"
    )
  })

  it("falls back to code label for unknown product code", () => {
    const unknownProduct: CatalogProduct = {
      code: "UNKNOWN_PRODUCT",
      name: "Unknown Product",
      description: null,
      plans: [],
    }
    const view = render(<CatalogProductCard product={unknownProduct} />)
    expect(view.getByText("UNKNOWN_PRODUCT")).toBeInTheDocument()
  })

  it("shows empty description when description is null", () => {
    const noDescProduct: CatalogProduct = {
      code: "VPN",
      name: "VPN",
      description: null,
      plans: [],
    }
    const view = render(<CatalogProductCard product={noDescProduct} />)
    expect(view.getByText("VPN")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(
      <CatalogProductCard product={whatsappProduct} className="custom-class" />
    )
    expect(container.firstChild).toHaveClass("custom-class")
  })
})
