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
    const { getByText, container } = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )

    expect(getByText("WhatsApp")).toBeInTheDocument()
    expect(getByText("WhatsApp Business messaging")).toBeInTheDocument()
    expect(getByText("WHATSAPP_STANDARD")).toBeInTheDocument()
    // Check for SVG icon (WhatsApp uses inline SVG)
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("renders VPN subscription with GlobeIcon", () => {
    const { getByText, container } = render(
      <SubscriptionCard subscription={vpnSubscription} />
    )

    expect(getByText("VPN")).toBeInTheDocument()
    expect(getByText("VPN_PREMIUM")).toBeInTheDocument()
    // GlobeIcon from Phosphor
    const globeIcon = container.querySelector('[class*="w-5"][class*="h-5"]')
    expect(globeIcon).toBeInTheDocument()
  })

  it("renders App Hosting subscription with RocketLaunchIcon", () => {
    const { getByText, container } = render(
      <SubscriptionCard subscription={appHostingSubscription} />
    )

    expect(getByText("App Hosting")).toBeInTheDocument()
    expect(getByText("APP_STARTER")).toBeInTheDocument()
    const rocketIcon = container.querySelector('[class*="w-5"][class*="h-5"]')
    expect(rocketIcon).toBeInTheDocument()
  })

  it("displays ACTIVE status badge with green styling", () => {
    const { getByText } = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )

    const statusBadge = getByText("ACTIVE")
    expect(statusBadge).toBeInTheDocument()
    expect(statusBadge.className).toContain("green")
  })

  it("displays SUSPENDED status badge with yellow styling", () => {
    const { getByText } = render(
      <SubscriptionCard subscription={appHostingSubscription} />
    )

    const statusBadge = getByText("SUSPENDED")
    expect(statusBadge).toBeInTheDocument()
    expect(statusBadge.className).toContain("yellow")
  })

  it("displays CANCELLED status badge with gray styling", () => {
    const { getByText } = render(
      <SubscriptionCard
        subscription={{ ...whatsappSubscription, status: "CANCELLED" }}
      />
    )

    const statusBadge = getByText("CANCELLED")
    expect(statusBadge).toBeInTheDocument()
    expect(statusBadge.className).toContain("gray")
  })

  it("displays WhatsApp quota information", () => {
    const { getByText } = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )

    expect(getByText("Quota In")).toBeInTheDocument()
expect(getByText(/1\.000/)).toBeInTheDocument()
    expect(getByText("Quota Out")).toBeInTheDocument()
    expect(getByText("500")).toBeInTheDocument()
  })

  it("displays monthly rate formatted as IDR", () => {
    const { getByText } = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )

    expect(getByText("Monthly Rate")).toBeInTheDocument()
    expect(getByText(/Rp\s*299\.?000/)).toBeInTheDocument()
  })

  it("displays next billing date formatted", () => {
    const { getByText } = render(
      <SubscriptionCard subscription={whatsappSubscription} />
    )

    expect(getByText("Next Billing")).toBeInTheDocument()
    expect(getByText("28 Jun 2026")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(
      <SubscriptionCard subscription={whatsappSubscription} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })
})
