import { describe, expect, it } from "bun:test"

import {
  DEFAULT_VPN_PLAN_CONFIG,
  VpnProvisionAdapter,
  parseVpnPlanConfig,
  validateVpnPlanConfig,
} from "./vpn-provision-adapter"
import {
  DEFAULT_APP_HOSTING_PLAN_CONFIG,
  AppHostingProvisionAdapter,
  parseAppHostingPlanConfig,
  validateAppHostingPlanConfig,
} from "./app-hosting-provision-adapter"
import {
  DEFAULT_WHATSAPP_PLAN_CONFIG,
  WhatsAppProvisionAdapter,
  parseWhatsAppPlanConfig,
  validateWhatsAppPlanConfig,
} from "./whatsapp-provision-adapter"

describe("built-in provision adapters", () => {
  it("exposes stable adapter ids and default blueprints", () => {
    expect(VpnProvisionAdapter.id).toBe("VPN")
    expect(AppHostingProvisionAdapter.id).toBe("APP_HOSTING")
    expect(WhatsAppProvisionAdapter.id).toBe("WHATSAPP")
    expect(DEFAULT_VPN_PLAN_CONFIG).toEqual({
      serverIds: [],
      customUsername: false,
    })
    expect(DEFAULT_APP_HOSTING_PLAN_CONFIG).toEqual({
      clusterIds: [],
      cpu: 1000,
      memory: 1024,
      storage: 20,
      maxCustomDomains: 3,
      wildcard: false,
      requiredDependencies: [],
    })
    expect(DEFAULT_WHATSAPP_PLAN_CONFIG).toEqual({
      quotaOut: 1000,
      quotaIn: 1000,
      maxDevices: 1,
      broadcast: false,
    })
  })

  it("parses VPN blueprints and rejects malformed values", () => {
    expect(
      parseVpnPlanConfig({ serverIds: ["server-1"], customUsername: true })
    ).toEqual({ serverIds: ["server-1"], customUsername: true })
    expect(
      parseVpnPlanConfig({
        features: { planName: "Private" },
        provisioning: { serverIds: ["server-2"], customUsername: true },
      })
    ).toEqual({ serverIds: ["server-2"], customUsername: true })
    expect(parseVpnPlanConfig({ serverIds: ["server-1"] })).toEqual({
      serverIds: ["server-1"],
      customUsername: false,
    })
    expect(validateVpnPlanConfig({ serverIds: [] }).valid).toBe(false)
    expect(validateVpnPlanConfig({ serverIds: ["server-1"] }).valid).toBe(true)
  })
  it("parses App Hosting blueprints and validates resource limits", () => {
    expect(
      parseAppHostingPlanConfig({ cpu: 2, memory: 1024, storage: 20 })
    ).toEqual({
      ...DEFAULT_APP_HOSTING_PLAN_CONFIG,
      cpu: 2,
      memory: 1024,
      storage: 20,
    })
    expect(
      parseAppHostingPlanConfig({
        features: { planName: "Starter" },
        provisioning: { cpu: 2, memory: 1024, storage: 20 },
      })
    ).toEqual({
      ...DEFAULT_APP_HOSTING_PLAN_CONFIG,
      cpu: 2,
      memory: 1024,
      storage: 20,
    })
    expect(
      validateAppHostingPlanConfig({
        cpu: 0,
        memory: 128,
        storage: 1,
        maxCustomDomains: 1,
        wildcard: false,
        requiredDependencies: [],
      }).valid
    ).toBe(false)
    expect(
      validateAppHostingPlanConfig({
        features: { planName: "Starter" },
        provisioning: {
          cpu: 1,
          memory: 128,
          storage: 1,
          maxCustomDomains: 1,
          wildcard: false,
          requiredDependencies: [],
        },
      }).valid
    ).toBe(true)
    expect(
      validateAppHostingPlanConfig({
        cpu: 1,
        memory: 128,
        storage: 1,
        maxCustomDomains: 1,
        wildcard: false,
        requiredDependencies: [],
      }).valid
    ).toBe(true)
  })

  it("parses WhatsApp blueprints and validates quotas", () => {
    expect(parseWhatsAppPlanConfig({ quotaOut: 500 })).toEqual({
      ...DEFAULT_WHATSAPP_PLAN_CONFIG,
      quotaOut: 500,
    })
    expect(
      parseWhatsAppPlanConfig({
        features: { planName: "Team" },
        provisioning: { quotaOut: 500, maxDevices: 2 },
      })
    ).toEqual({
      ...DEFAULT_WHATSAPP_PLAN_CONFIG,
      quotaOut: 500,
      maxDevices: 2,
    })
    expect(
      validateWhatsAppPlanConfig({
        quotaOut: 0,
        quotaIn: 1,
        maxDevices: 1,
        broadcast: false,
      }).valid
    ).toBe(false)
    expect(
      validateWhatsAppPlanConfig({
        features: { planName: "Team" },
        provisioning: {
          quotaOut: 1,
          quotaIn: 1,
          maxDevices: 1,
          broadcast: true,
        },
      }).valid
    ).toBe(true)
    expect(
      validateWhatsAppPlanConfig({
        quotaOut: 1,
        quotaIn: 1,
        maxDevices: 1,
        broadcast: true,
      }).valid
    ).toBe(true)
  })
})
