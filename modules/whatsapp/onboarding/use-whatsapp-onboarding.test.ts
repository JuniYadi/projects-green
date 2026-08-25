import { describe, expect, it } from "bun:test"
import {
  computeOnboardingLevel,
  getFeatureUnlockLevel,
} from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"

describe("WhatsApp Onboarding Engine", () => {
  it("computes level 0 when no subscription and no devices exist", () => {
    const level = computeOnboardingLevel({
      hasSubscription: false,
      deviceCount: 0,
      templateCount: 0,
      messageCount: 0,
      apiKeyCount: 0,
    })
    expect(level).toBe(0)
  })

  it("computes level 0_pending (tower clearance) when subscribed but waiting for device", () => {
    const level = computeOnboardingLevel({
      hasSubscription: true,
      deviceCount: 0,
      templateCount: 0,
      messageCount: 0,
      apiKeyCount: 0,
    })
    expect(level).toBe("0_pending")
  })

  it("computes level 1 when device is active but no messages or templates", () => {
    const level = computeOnboardingLevel({
      hasSubscription: true,
      deviceCount: 1,
      templateCount: 0,
      messageCount: 0,
      apiKeyCount: 0,
    })
    expect(level).toBe(1)
  })

  it("computes level 2 when template and message are created", () => {
    const level = computeOnboardingLevel({
      hasSubscription: true,
      deviceCount: 1,
      templateCount: 1,
      messageCount: 5,
      apiKeyCount: 0,
    })
    expect(level).toBe(2)
  })

  it("computes level 3 when api keys exist", () => {
    const level = computeOnboardingLevel({
      hasSubscription: true,
      deviceCount: 1,
      templateCount: 1,
      messageCount: 5,
      apiKeyCount: 1,
    })
    expect(level).toBe(3)
  })

  it("verifies unlock thresholds for various features", () => {
    expect(getFeatureUnlockLevel("usage")).toBe(0)
    expect(getFeatureUnlockLevel("pricing_ledger")).toBe(0)
    expect(getFeatureUnlockLevel("devices")).toBe(1)
    expect(getFeatureUnlockLevel("messages")).toBe(1)
    expect(getFeatureUnlockLevel("contacts")).toBe(1)
    expect(getFeatureUnlockLevel("templates")).toBe(2)
    expect(getFeatureUnlockLevel("broadcasts")).toBe(2)
    expect(getFeatureUnlockLevel("catalogs")).toBe(2)
    expect(getFeatureUnlockLevel("api_keys")).toBe(2)
    expect(getFeatureUnlockLevel("webhook_logs")).toBe(3)
    expect(getFeatureUnlockLevel("audit_logs")).toBe(3)
  })
})
