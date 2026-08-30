import { describe, it, expect, beforeEach } from "bun:test"
import { useWhatsAppOnboardingStore } from "./whatsapp-onboarding.store"

describe("useWhatsAppOnboardingStore", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useWhatsAppOnboardingStore.setState({
      isGraduated: false,
      progressPercent: 0,
    })
  })

  it("updates graduation state and syncs to sessionStorage", () => {
    expect(useWhatsAppOnboardingStore.getState().isGraduated).toBe(false)

    useWhatsAppOnboardingStore.getState().setIsGraduated(true)
    expect(useWhatsAppOnboardingStore.getState().isGraduated).toBe(true)
    expect(sessionStorage.getItem("whatsapp_onboarding_graduated")).toBe("true")

    useWhatsAppOnboardingStore.getState().setIsGraduated(false)
    expect(useWhatsAppOnboardingStore.getState().isGraduated).toBe(false)
    expect(sessionStorage.getItem("whatsapp_onboarding_graduated")).toBeNull()
  })

  it("syncs state from storage on demand", () => {
    localStorage.setItem("whatsapp_onboarding_graduated", "true")
    useWhatsAppOnboardingStore.getState().syncFromStorage()
    expect(useWhatsAppOnboardingStore.getState().isGraduated).toBe(true)

    localStorage.clear()
    sessionStorage.setItem("whatsapp_onboarding_graduated", "true")
    useWhatsAppOnboardingStore.setState({ isGraduated: false })
    useWhatsAppOnboardingStore.getState().syncFromStorage()
    expect(useWhatsAppOnboardingStore.getState().isGraduated).toBe(true)
  })

  it("updates progress percentage", () => {
    useWhatsAppOnboardingStore.getState().setProgressPercent(85)
    expect(useWhatsAppOnboardingStore.getState().progressPercent).toBe(85)
  })
})
