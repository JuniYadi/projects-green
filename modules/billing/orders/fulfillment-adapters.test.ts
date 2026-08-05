import { describe, expect, it } from "bun:test"
import type { ServiceType } from "@prisma/client"
import {
  BillingFulfillmentRegistry,
  createBillingFulfillmentRegistry,
  type BillingFulfillmentAdapter,
} from "./fulfillment-adapters"

const adapter = (packageCode: ServiceType): BillingFulfillmentAdapter => ({
  packageCode,
  create: async () => ({ subscriptionId: "sub-1" }),
  renew: async () => {},
})

describe("BillingFulfillmentRegistry", () => {
  it("selects by package code without plan-code guessing", () => {
    const registry = new BillingFulfillmentRegistry([
      adapter("VPN"),
      adapter("WHATSAPP"),
    ])

    expect(registry.get("VPN").packageCode).toBe("VPN")
    expect(registry.get("WHATSAPP").packageCode).toBe("WHATSAPP")
  })

  it("registers exactly VPN and WhatsApp by default while leaving App Hosting unconfigured", () => {
    const registry = createBillingFulfillmentRegistry()

    expect(registry.get("VPN").packageCode).toBe("VPN")
    expect(registry.get("WHATSAPP").packageCode).toBe("WHATSAPP")
    expect(() => registry.get("APP_HOSTING")).toThrow(
      "FULFILLMENT_NOT_CONFIGURED"
    )
  })

  it("rejects an unregistered package with FULFILLMENT_NOT_CONFIGURED", () => {
    const registry = new BillingFulfillmentRegistry([])

    expect(() => registry.get("APP_HOSTING")).toThrow(
      "FULFILLMENT_NOT_CONFIGURED"
    )
  })
})
