import { afterEach, describe, expect, it } from "bun:test"
import type { ServiceType } from "@prisma/client"

import type { ProductProvisionAdapter } from "./product-provision-adapter.types"
import {
  clearProvisionAdapters,
  getProvisionAdapter,
  hasProvisionAdapter,
  listProvisionAdapters,
  registerAdapter,
} from "./provision-adapter-registry"

const adapter = (id: ServiceType): ProductProvisionAdapter => ({
  id,
  name: `${id} adapter`,
  description: `${id} provisioning adapter`,
  PlanConfigComponent: () => null,
})

afterEach(() => {
  clearProvisionAdapters()
})

describe("provision adapter registry", () => {
  it("registers and looks up an adapter by service type", () => {
    const vpnAdapter = adapter("VPN")

    registerAdapter(vpnAdapter)

    expect(hasProvisionAdapter("VPN")).toBe(true)
    expect(getProvisionAdapter("VPN")).toBe(vpnAdapter)
  })

  it("rejects duplicate registrations for a service type", () => {
    registerAdapter(adapter("VPN"))

    expect(() => registerAdapter(adapter("VPN"))).toThrow(
      'Provision adapter "VPN" is already registered'
    )
  })

  it("returns the supplied fallback when no adapter is registered", () => {
    const fallback = adapter("APP_HOSTING")

    expect(getProvisionAdapter("VPN", fallback)).toBe(fallback)
    expect(getProvisionAdapter("VPN")).toBeUndefined()
    expect(hasProvisionAdapter("VPN")).toBe(false)
  })

  it("lists registered adapters in registration order", () => {
    const appHostingAdapter = adapter("APP_HOSTING")
    const vpnAdapter = adapter("VPN")
    const whatsappAdapter = adapter("WHATSAPP")

    registerAdapter(appHostingAdapter)
    registerAdapter(vpnAdapter)
    registerAdapter(whatsappAdapter)

    expect(listProvisionAdapters()).toEqual([
      appHostingAdapter,
      vpnAdapter,
      whatsappAdapter,
    ])
  })
})
