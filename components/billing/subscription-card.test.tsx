import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render, screen } from "@testing-library/react"

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
    render(<SubscriptionCard subscription={whatsappSubscription} />)
    expect(screen.getByText("WhatsApp")).toBeInTheDocument()
    expect(screen.getByText("WhatsApp Business messaging")).toBeInTheDocument()
    expect(screen.getByText("WHATSAPP_STANDARD")).toBeInTheDocument()
  })

  it("renders VPN subscription with GlobeIcon", () => {
    render(<SubscriptionCard subscription={vpnSubscription} />)
    expect(screen.getByText("VPN")).toBeInTheDocument()
    expect(screen.getByText("VPN_PREMIUM")).toBeInTheDocument()
  })

  it("renders App Hosting subscription with RocketLaunchIcon", () => {
    render(<SubscriptionCard subscription={appHostingSubscription} />)
    expect(screen.getByText("App Hosting")).toBeInTheDocument()
    expect(screen.getByText("APP_STARTER")).toBeInTheDocument()
  })

  it("displays ACTIVE status text", () => {
    render(<SubscriptionCard subscription={whatsappSubscription} />)
    expect(screen.getByText("ACTIVE")).toBeInTheDocument()
  })

  it("displays SUSPENDED status text", () => {
    render(<SubscriptionCard subscription={appHostingSubscription} />)
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument()
  })

  it("displays CANCELLED status text", () => {
    render(
      <SubscriptionCard
        subscription={{ ...whatsappSubscription, status: "CANCELLED" }}
      />
    )
    expect(screen.getByText("CANCELLED")).toBeInTheDocument()
  })

  it("displays WhatsApp quota information", () => {
    render(<SubscriptionCard subscription={whatsappSubscription} />)
    expect(screen.getByText("Quota In")).toBeInTheDocument()
    expect(screen.getByText("1,000")).toBeInTheDocument()
    expect(screen.getByText("Quota Out")).toBeInTheDocument()
    expect(screen.getByText("500")).toBeInTheDocument()
  })

  it("displays monthly rate formatted as IDR", () => {
    render(<SubscriptionCard subscription={whatsappSubscription} />)
    expect(screen.getByText("Monthly Rate")).toBeInTheDocument()
    expect(screen.getByText(/Rp\s*299\.?000/)).toBeInTheDocument()
  })

  it("displays next billing date formatted", () => {
    render(<SubscriptionCard subscription={whatsappSubscription} />)
    expect(screen.getByText("Next Billing")).toBeInTheDocument()
    expect(screen.getByText("28 Jun 2026")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(
      <SubscriptionCard subscription={whatsappSubscription} className="custom-class" />
    )
    expect(container.firstChild).toHaveClass("custom-class")
  })
})
