import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
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
  it("renders the onboarding guide pill", () => {
    const view = render(<FlightHudWidget onboarding={mockState} />)
    expect(view.getByText("Onboarding Guide")).toBeInTheDocument()
    expect(view.getByText("60%")).toBeInTheDocument()
  })
})
