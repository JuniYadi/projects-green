import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { FlightHudWidget } from "./flight-hud-widget"
import type { WhatsAppOnboardingState } from "./use-whatsapp-onboarding"

const mockState: WhatsAppOnboardingState = {
  level: 1,
  progressPercent: 60,
  isGraduated: false,
  hasSubscription: true,
  hasDevice: true,
  hasTemplate: false,
  hasMessage: false,
  hasApiKey: false,
  missions: [
    {
      level: 1,
      title: "Transmit First Message",
      subtitle: "Payload",
      description: "Send test message",
      actionLabel: "Open Messages",
      actionHref: "/console/whatsapp/messages",
      completed: false,
    },
  ],
  activeMission: {
    level: 1,
    title: "Transmit First Message",
    subtitle: "Payload",
    description: "Send test message",
    actionLabel: "Open Messages",
    actionHref: "/console/whatsapp/messages",
    completed: false,
  },
  replayLevel: null,
  setReplayLevel: mock(() => {}),
  isFeatureLocked: mock(() => false),
  getFeatureUnlockLevel: mock(() => 1),
  graduateNow: mock(() => {}),
  resetOnboarding: mock(() => {}),
}

describe("FlightHudWidget", () => {
  beforeEach(() => {
    cleanup()
  })

  it("hides the widget after mount when previously dismissed in localStorage", () => {
    localStorage.setItem("whatsapp_onboarding_hud_closed", "true")
    const view = render(<FlightHudWidget onboarding={mockState} />)
    expect(view.queryByText("Onboarding Guide")).not.toBeInTheDocument()
    localStorage.removeItem("whatsapp_onboarding_hud_closed")
  })
  it("hides the widget when isGraduated is true or progressPercent is 100", () => {
    const graduatedState: WhatsAppOnboardingState = {
      ...mockState,
      isGraduated: true,
      progressPercent: 100,
    }
    const view = render(<FlightHudWidget onboarding={graduatedState} />)
    expect(view.queryByText("Onboarding Guide")).not.toBeInTheDocument()
  })

  it("renders the onboarding guide pill", () => {
    const view = render(<FlightHudWidget onboarding={mockState} />)
    expect(view.getByText("Onboarding Guide")).toBeInTheDocument()
    expect(view.getByText("60%")).toBeInTheDocument()
  })

  it("renders Indonesian HUD controls for the supplied locale", () => {
    const view = render(<FlightHudWidget onboarding={mockState} locale="id" />)

    expect(view.getByText("Panduan Penyiapan")).toBeInTheDocument()
    fireEvent.click(view.getByText("Panduan Penyiapan"))

    expect(view.getByText("Butuh Bantuan?")).toBeInTheDocument()
  })

  it("renders localized Lv 0 (Tower) when level is 0_pending in English", () => {
    const pendingState: WhatsAppOnboardingState = {
      ...mockState,
      level: "0_pending",
    }
    const view = render(
      <FlightHudWidget onboarding={pendingState} locale="en" />
    )
    fireEvent.click(view.getByText("Onboarding Guide"))
    expect(view.getByText("Lv 0 (Tower)")).toBeInTheDocument()
  })

  it("renders localized Lv 0 (Verifikasi) when level is 0_pending in Indonesian", () => {
    const pendingState: WhatsAppOnboardingState = {
      ...mockState,
      level: "0_pending",
    }
    const view = render(
      <FlightHudWidget onboarding={pendingState} locale="id" />
    )
    fireEvent.click(view.getByText("Panduan Penyiapan"))
    expect(view.getByText("Lv 0 (Verifikasi)")).toBeInTheDocument()
  })
})
