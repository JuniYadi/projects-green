import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { SubscriptionCard } from "./subscription-card"

describe("SubscriptionCard", () => {
  const whatsappSubscription = {
    id: "sub-1",
    packageCode: "WHATSAPP",
    planCode: "WHATSAPP_STANDARD",
    regionCode: "GLOBAL",
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    status: "ACTIVE",
    allocatedConfig: null,
    monthlyRateIdr: "299000.00",
    currentPeriodEnd: "2026-06-28T00:00:00Z",
    quotaIn: 1000,
    quotaOut: 500,
    dailyPerDevice: 100,
  }

  const vpnSubscription = {
    id: "sub-2",
    packageCode: "VPN",
    planCode: "VPN_PREMIUM",
    regionCode: "SG",
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    status: "ACTIVE",
    allocatedConfig: null,
    monthlyRateIdr: "50000.00",
    currentPeriodEnd: "2026-06-15T00:00:00Z",
  }

  const appHostingSubscription = {
    id: "sub-3",
    packageCode: "APP_HOSTING",
    planCode: "APP_STARTER",
    regionCode: "GLOBAL",
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    status: "SUSPENDED",
    allocatedConfig: null,
    monthlyRateIdr: "150000.00",
    currentPeriodEnd: "2026-05-28T00:00:00Z",
  }

  it("renders WhatsApp subscription with WhatsApp icon", () => {
    const view = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )
    expect(view.getByText("WhatsApp")).toBeInTheDocument()
    expect(view.getByText("WhatsApp Business messaging")).toBeInTheDocument()
    expect(view.getByText("WHATSAPP_STANDARD")).toBeInTheDocument()
  })

  it("renders VPN subscription with GlobeIcon", () => {
    const view = render(<SubscriptionCard subscription={vpnSubscription} />)
    expect(view.getByText("VPN")).toBeInTheDocument()
    expect(view.getByText("VPN_PREMIUM")).toBeInTheDocument()
  })

  it("renders App Hosting subscription with RocketLaunchIcon", () => {
    const view = render(
      <SubscriptionCard subscription={appHostingSubscription} />
    )
    expect(view.getByText("App Hosting")).toBeInTheDocument()
    expect(view.getByText("APP_STARTER")).toBeInTheDocument()
  })

  it("displays ACTIVE status text", () => {
    const view = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )
    expect(view.getAllByText("Active").length).toBeGreaterThan(0)
  })

  it("displays SUSPENDED status text", () => {
    const view = render(
      <SubscriptionCard subscription={appHostingSubscription} />
    )
    expect(view.getAllByText("Suspended").length).toBeGreaterThan(0)
  })

  it("displays CANCELLED status text", () => {
    const view = render(
      <SubscriptionCard
        subscription={{ ...whatsappSubscription, status: "CANCELLED" }}
      />
    )
    expect(view.getAllByText("Cancelled").length).toBeGreaterThan(0)
  })

  it("displays WhatsApp quota information", () => {
    const view = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )
    expect(view.getAllByText("Quota In").length).toBeGreaterThan(0)
    expect(view.getAllByText("1.000").length).toBeGreaterThan(0)
    expect(view.getAllByText("Quota Out").length).toBeGreaterThan(0)
    expect(view.getAllByText("500").length).toBeGreaterThan(0)
  })

  it("displays period price formatted as IDR", () => {
    const view = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )
    expect(
      view.getAllByText(/Period price|Period Price/i).length
    ).toBeGreaterThan(0)
    expect(view.getAllByText(/Rp\s*299\.?000/).length).toBeGreaterThan(0)
  })

  it("displays next billing date formatted", () => {
    const view = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )
    expect(view.getAllByText(/Renewal|Next Billing/i).length).toBeGreaterThan(0)
    expect(view.getAllByText("28 Jun 2026").length).toBeGreaterThan(0)
  })
  it("applies custom className", () => {
    const { container } = render(
      <SubscriptionCard
        subscription={whatsappSubscription}
        className="custom-class"
      />
    )
    expect(container.firstChild).toHaveClass("custom-class")
  })
})
