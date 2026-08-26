import { describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import { ConsoleOnboardingTour } from "@/components/console-onboarding-tour"

const runConsoleTour = mock(async () => null)

mock.module("@/lib/onboarding/console-tour", () => ({
  runConsoleTour,
}))

mock.module("next/navigation", () => ({
  usePathname: () => "/id/console/whatsapp",
}))

describe("ConsoleOnboardingTour", () => {
  it("triggers runConsoleTour on mount with active locale", async () => {
    runConsoleTour.mockClear()

    render(<ConsoleOnboardingTour />)

    await waitFor(() => {
      expect(runConsoleTour).toHaveBeenCalledTimes(1)
      expect(runConsoleTour).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: "id",
        })
      )
    })
  })
})
