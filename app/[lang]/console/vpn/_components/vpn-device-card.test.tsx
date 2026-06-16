import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { VpnDeviceCard } from "./vpn-device-card"
import type { MobileDeviceEntry } from "@/lib/vpn-mobile-client"

const activeDevice: MobileDeviceEntry = {
  id: "dev-1",
  deviceName: "iPhone 15 Pro",
  platform: "ios",
  osVersion: "18.2.1",
  subscriptionId: "sub-1",
  subscriptionName: null,
  subscriptionStatus: "ACTIVE",
  status: "ACTIVE",
  pairedVia: "SSO",
  lastSeenAt: "2026-06-16T10:00:00Z",
  pairedAt: "2026-06-14T08:00:00Z",
  revokedAt: null,
  revokedReason: null,
}

const revokedDevice: MobileDeviceEntry = {
  ...activeDevice,
  id: "dev-2",
  deviceName: "Revoked Pixel",
  platform: "android",
  status: "REVOKED",
  revokedAt: "2026-06-15T12:00:00Z",
  revokedReason: "Lost device",
}

describe("VpnDeviceCard", () => {
  it("renders device name, platform badge, and status badge", () => {
    const view = render(
      <VpnDeviceCard
        device={activeDevice}
        onRevoke={() => {}}
        revoking={null}
      />
    )

    expect(view.getByText("iPhone 15 Pro")).toBeInTheDocument()
    expect(view.getByText("iOS")).toBeInTheDocument()
    expect(view.getByText("ACTIVE")).toBeInTheDocument()
  })

  it("shows revoke button for ACTIVE device", () => {
    const view = render(
      <VpnDeviceCard
        device={activeDevice}
        onRevoke={() => {}}
        revoking={null}
      />
    )

    expect(view.getByText("Revoke")).toBeInTheDocument()
  })

  it("shows Revoked badge instead of revoke button for REVOKED device", () => {
    const view = render(
      <VpnDeviceCard
        device={revokedDevice}
        onRevoke={() => {}}
        revoking={null}
      />
    )

    expect(view.getByText("Revoked")).toBeInTheDocument()
    expect(() => view.getByText("Revoke")).toThrow()
  })

  it("renders paired via and paired date", () => {
    const view = render(
      <VpnDeviceCard
        device={activeDevice}
        onRevoke={() => {}}
        revoking={null}
      />
    )

    expect(view.getByText("SSO")).toBeInTheDocument()
    expect(view.getByText("Paired Via")).toBeInTheDocument()
    expect(view.getByText("Paired At")).toBeInTheDocument()
  })

  it("shows Revoking… when revoking prop matches device id", () => {
    const view = render(
      <VpnDeviceCard
        device={activeDevice}
        onRevoke={() => {}}
        revoking="dev-1"
      />
    )

    expect(view.getByText("Revoking…")).toBeInTheDocument()
  })
})
