import { describe, expect, it, mock } from "bun:test"

import { runIndonesianLocaleCue } from "@/lib/i18n/indonesian-locale-cue"

describe("Indonesian locale cue", () => {
  it("loads Driver.js only for a connected language control and honors reduced motion", async () => {
    const target = document.createElement("button")
    document.body.append(target)
    const drive = mock(() => {})
    const destroy = mock(() => {})
    const driver = mock(() => ({ drive, destroy }))
    const loadDriver = mock(async () => ({ driver }))
    const loadStyles = mock(async () => ({}))

    const cleanup = await runIndonesianLocaleCue({
      target,
      messages: {
        title: "Language options",
        description: "Choose your language.",
      },
      reducedMotion: true,
      loaders: { loadDriver, loadStyles },
    })

    expect(loadStyles).toHaveBeenCalledTimes(1)
    expect(loadDriver).toHaveBeenCalledTimes(1)
    expect(driver).toHaveBeenCalledWith(
      expect.objectContaining({
        animate: false,
        allowClose: true,
        showButtons: ["close"],
      })
    )
    expect(drive).toHaveBeenCalledTimes(1)

    cleanup?.()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it("does not load Driver.js when its direct control target is unavailable", async () => {
    const loadDriver = mock(async () => ({
      driver: mock(() => ({ drive: mock(() => {}), destroy: mock(() => {}) })),
    }))
    const loadStyles = mock(async () => ({}))

    await expect(
      runIndonesianLocaleCue({
        target: null,
        messages: { title: "Language options", description: "Choose." },
        reducedMotion: false,
        loaders: { loadDriver, loadStyles },
      })
    ).resolves.toBeNull()

    expect(loadStyles).not.toHaveBeenCalled()
    expect(loadDriver).not.toHaveBeenCalled()
  })
})
