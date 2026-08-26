import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import {
  runConsoleTour,
  CONSOLE_TOUR_STORAGE_KEY,
} from "@/lib/onboarding/console-tour"

describe("runConsoleTour", () => {
  it("initializes Driver.js with 4 main anchors and respects completed storage key", async () => {
    window.localStorage.clear()

    const drive = mock(() => {})
    const destroy = mock(() => {})
    const driver = mock(() => ({ drive, destroy }))
    const loadDriver = mock(async () => ({ driver }))
    const loadStyles = mock(async () => ({}))

    const cleanup = await runConsoleTour({
      locale: "id",
      force: false,
      loaders: { loadDriver, loadStyles },
    })

    expect(loadStyles).toHaveBeenCalledTimes(1)
    expect(loadDriver).toHaveBeenCalledTimes(1)
    expect(driver).toHaveBeenCalledWith(
      expect.objectContaining({
        nextBtnText: "Lanjut",
        prevBtnText: "Kembali",
        doneBtnText: "Selesai",
        steps: expect.arrayContaining([
          expect.objectContaining({
            element: '[data-tour="org-selector"]',
          }),
          expect.objectContaining({
            element: '[data-tour="sidebar-menu"]',
          }),
          expect.objectContaining({
            element: '[data-tour="user-profile"]',
          }),
          expect.objectContaining({
            element: '[data-tour="ai-helper"]',
          }),
        ]),
      })
    )
    expect(drive).toHaveBeenCalledTimes(1)

    cleanup?.()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it("does not run if already marked completed unless force=true", async () => {
    window.localStorage.setItem(CONSOLE_TOUR_STORAGE_KEY, "true")

    const drive = mock(() => {})
    const destroy = mock(() => {})
    const driver = mock(() => ({ drive, destroy }))
    const loadDriver = mock(async () => ({ driver }))
    const loadStyles = mock(async () => ({}))

    const result = await runConsoleTour({
      locale: "en",
      force: false,
      loaders: { loadDriver, loadStyles },
    })

    expect(result).toBeNull()
    expect(loadDriver).not.toHaveBeenCalled()

    const forcedResult = await runConsoleTour({
      locale: "en",
      force: true,
      loaders: { loadDriver, loadStyles },
    })

    expect(forcedResult).not.toBeNull()
    expect(loadDriver).toHaveBeenCalledTimes(1)
  })
})
