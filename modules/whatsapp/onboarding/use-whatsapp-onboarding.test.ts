import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, renderHook } from "@testing-library/react"
import {
  computeOnboardingLevel,
  getFeatureUnlockLevel,
  useWhatsAppOnboarding,
} from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"

const replayStorageKey = "whatsapp_onboarding_replay_level"
const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, data: {} }), {
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  localStorage.removeItem(replayStorageKey)
  localStorage.removeItem("whatsapp_onboarding_graduated")
})

const renderOnboardingHook = (
  input: Parameters<typeof useWhatsAppOnboarding>[0]
) =>
  renderHook(() => useWhatsAppOnboarding(input), {
    container: document.createElement("div"),
  })

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

  it("generates Indonesian missions and localized action links", () => {
    const { result } = renderOnboardingHook({
      locale: "id",
      hasSubscription: true,
      deviceCount: 1,
      templateCount: 0,
      messageCount: 0,
      apiKeyCount: 0,
    })

    expect(result.current.missions.map((mission) => mission.title)).toEqual([
      "Aktifkan Paket WhatsApp",
      "Alokasi Nomor & Perangkat",
      "Kirim Pesan Pertama",
      "Buat & Setujui Template Pesan",
      "Buat API Key Produksi",
    ])
    expect(
      result.current.missions.map((mission) => mission.actionHref)
    ).toEqual([
      undefined,
      "/id/console/whatsapp/devices",
      "/id/console/whatsapp/messages",
      "/id/console/whatsapp/templates/new",
      "/id/console/whatsapp/api-keys",
    ])
  })

  it("generates English missions and localized action links", () => {
    const { result } = renderOnboardingHook({
      locale: "en",
      hasSubscription: true,
      deviceCount: 1,
      templateCount: 0,
      messageCount: 0,
      apiKeyCount: 0,
    })

    expect(result.current.missions.map((mission) => mission.title)).toEqual([
      "Subscribe to WhatsApp Plan",
      "Transponder Hardware Allocation",
      "Transmit First Message",
      "Draft & Approve Message Template",
      "Generate Production API Key",
    ])
    expect(
      result.current.missions.map((mission) => mission.actionHref)
    ).toEqual([
      undefined,
      "/en/console/whatsapp/devices",
      "/en/console/whatsapp/messages",
      "/en/console/whatsapp/templates/new",
      "/en/console/whatsapp/api-keys",
    ])
  })

  it("resolves the active mission from replay level and restores normal progression", () => {
    const { result } = renderOnboardingHook({
      locale: "en",
      hasSubscription: true,
      deviceCount: 1,
      templateCount: 0,
      messageCount: 0,
      apiKeyCount: 0,
    })

    expect(result.current.level).toBe(1)
    expect(result.current.activeMission.level).toBe(1)

    act(() => result.current.setReplayLevel(2))

    expect(result.current.replayLevel).toBe(2)
    expect(result.current.activeMission.level).toBe(2)
    expect(result.current.activeMission.title).toBe(
      "Draft & Approve Message Template"
    )
    expect(localStorage.getItem(replayStorageKey)).toBe("2")

    act(() => result.current.setReplayLevel(null))

    expect(result.current.replayLevel).toBeNull()
    expect(result.current.activeMission.level).toBe(1)
    expect(localStorage.getItem(replayStorageKey)).toBeNull()
  })
})
