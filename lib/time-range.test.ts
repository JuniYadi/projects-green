import { describe, expect, it } from "bun:test"
import {
  PRESET_LABELS,
  PRESET_SECONDS,
  format24hDateTime,
  format24hTime,
  formatTelemetryTick,
  resolveTimeRangeBounds,
} from "./time-range"

describe("time-range constants", () => {
  it("defines expected preset labels", () => {
    expect(PRESET_LABELS["5m"]).toBe("Last 5 minutes")
    expect(PRESET_LABELS["15m"]).toBe("Last 15 minutes")
    expect(PRESET_LABELS["30m"]).toBe("Last 30 minutes")
    expect(PRESET_LABELS["1h"]).toBe("Last 1 hour")
    expect(PRESET_LABELS["6h"]).toBe("Last 6 hours")
    expect(PRESET_LABELS["24h"]).toBe("Last 24 hours")
    expect(PRESET_LABELS["7d"]).toBe("Last 7 days")
  })

  it("defines expected preset durations in seconds", () => {
    expect(PRESET_SECONDS["5m"]).toBe(300)
    expect(PRESET_SECONDS["15m"]).toBe(900)
    expect(PRESET_SECONDS["30m"]).toBe(1800)
    expect(PRESET_SECONDS["1h"]).toBe(3600)
    expect(PRESET_SECONDS["6h"]).toBe(21600)
    expect(PRESET_SECONDS["24h"]).toBe(86400)
    expect(PRESET_SECONDS["7d"]).toBe(604800)
  })
})

describe("format24hTime", () => {
  const testDate = new Date("2026-09-08T14:30:45Z")
  const testUnixSeconds = 1788877845

  it("formats time without seconds in 24h format", () => {
    expect(format24hTime(testDate, { timeZone: "UTC" })).toBe("14:30")
    expect(format24hTime(testUnixSeconds, { timeZone: "UTC" })).toBe("14:30")
  })

  it("formats time with seconds in 24h format when showSeconds is true", () => {
    expect(
      format24hTime(testDate, { showSeconds: true, timeZone: "UTC" })
    ).toBe("14:30:45")
    expect(
      format24hTime(testUnixSeconds, { showSeconds: true, timeZone: "UTC" })
    ).toBe("14:30:45")
  })

  it("respects custom timezone", () => {
    expect(format24hTime(testDate, { timeZone: "Asia/Jakarta" })).toBe("21:30")
    expect(
      format24hTime(testDate, { showSeconds: true, timeZone: "Asia/Jakarta" })
    ).toBe("21:30:45")
  })

  it("formats midnight as 00:00 without AM/PM", () => {
    const midnight = new Date("2026-09-08T00:00:00Z")
    expect(format24hTime(midnight, { timeZone: "UTC" })).toBe("00:00")
    expect(
      format24hTime(midnight, { showSeconds: true, timeZone: "UTC" })
    ).toBe("00:00:00")
  })
})

describe("format24hDateTime", () => {
  const testDate = new Date("2026-09-08T14:30:45Z")
  const testUnixSeconds = 1788877845

  it("produces 24h formatted date time string DD MMM HH:mm", () => {
    expect(format24hDateTime(testDate, "UTC")).toBe("08 Sep 14:30")
    expect(format24hDateTime(testUnixSeconds, "UTC")).toBe("08 Sep 14:30")
  })

  it("respects custom timezone", () => {
    expect(format24hDateTime(testDate, "Asia/Jakarta")).toBe("08 Sep 21:30")
  })
})

describe("formatTelemetryTick", () => {
  const timestamp = 1788877845 // 2026-09-08T14:30:45Z

  it("shows seconds resolution for duration <= 15m (900s)", () => {
    expect(formatTelemetryTick(timestamp, 300, "UTC")).toBe("14:30:45")
    expect(formatTelemetryTick(timestamp, 900, "UTC")).toBe("14:30:45")
  })

  it("shows hours and minutes for duration <= 24h (86400s)", () => {
    expect(formatTelemetryTick(timestamp, 1800, "UTC")).toBe("14:30")
    expect(formatTelemetryTick(timestamp, 3600, "UTC")).toBe("14:30")
    expect(formatTelemetryTick(timestamp, 21600, "UTC")).toBe("14:30")
    expect(formatTelemetryTick(timestamp, 86400, "UTC")).toBe("14:30")
  })

  it("shows date and time for duration > 24h", () => {
    expect(formatTelemetryTick(timestamp, 86401, "UTC")).toBe("08 Sep 14:30")
    expect(formatTelemetryTick(timestamp, 604800, "UTC")).toBe("08 Sep 14:30")
  })
})

describe("resolveTimeRangeBounds", () => {
  const alignedNow = 172800

  it("resolves preset 5m", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "5m" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 300,
      stepSeconds: 15,
      rateWindow: "30s",
    })
  })

  it("resolves preset 15m", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "15m" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 900,
      stepSeconds: 30,
      rateWindow: "1m",
    })
  })

  it("resolves preset 30m", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "30m" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 1800,
      stepSeconds: 60,
      rateWindow: "2m",
    })
  })

  it("resolves preset 1h", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "1h" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 3600,
      stepSeconds: 300,
      rateWindow: "5m",
    })
  })

  it("resolves preset 6h", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "6h" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 21600,
      stepSeconds: 1800,
      rateWindow: "15m",
    })
  })

  it("resolves preset 24h", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "24h" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 86400,
      stepSeconds: 7200,
      rateWindow: "30m",
    })
  })

  it("resolves preset 7d", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "7d" },
      alignedNow
    )
    expect(bounds).toEqual({
      endSeconds: 172800,
      startSeconds: 172800 - 604800,
      stepSeconds: 14400,
      rateWindow: "2h",
    })
  })

  it("rounds endSeconds down to stepSeconds when unaligned", () => {
    const bounds = resolveTimeRangeBounds(
      { type: "preset", preset: "5m" },
      1007
    )
    expect(bounds.endSeconds).toBe(1005)
    expect(bounds.startSeconds).toBe(705)
    expect(bounds.stepSeconds).toBe(15)
  })

  it("uses current time when nowSeconds is omitted", () => {
    const nowBefore = Math.floor(Date.now() / 1000)
    const bounds = resolveTimeRangeBounds({ type: "preset", preset: "1h" })
    const nowAfter = Math.floor(Date.now() / 1000)

    expect(bounds.endSeconds).toBeGreaterThanOrEqual(
      Math.floor((nowBefore - 300) / 300) * 300
    )
    expect(bounds.endSeconds).toBeLessThanOrEqual(
      Math.floor(nowAfter / 300) * 300
    )
    expect(bounds.startSeconds).toBe(bounds.endSeconds - 3600)
    expect(bounds.stepSeconds).toBe(300)
    expect(bounds.rateWindow).toBe("5m")
  })

  describe("custom ranges", () => {
    it("resolves short custom range (step <= 30 -> rateWindow 1m)", () => {
      const bounds = resolveTimeRangeBounds({
        type: "custom",
        from: 1000,
        to: 1600, // duration 600, step = max(15, floor(600/30)) = 20 <= 30
      })
      expect(bounds).toEqual({
        startSeconds: 1000,
        endSeconds: 1600,
        stepSeconds: 20,
        rateWindow: "1m",
      })
    })

    it("enforces minimum step of 15 seconds", () => {
      const bounds = resolveTimeRangeBounds({
        type: "custom",
        from: 1000,
        to: 1100, // duration 100, floor(100/30) = 3 -> step = 15
      })
      expect(bounds).toEqual({
        startSeconds: 1000,
        endSeconds: 1100,
        stepSeconds: 15,
        rateWindow: "1m",
      })
    })

    it("resolves medium custom range (step <= 120 -> rateWindow 2m)", () => {
      const bounds = resolveTimeRangeBounds({
        type: "custom",
        from: 1000,
        to: 4000, // duration 3000, step = 100 <= 120
      })
      expect(bounds).toEqual({
        startSeconds: 1000,
        endSeconds: 4000,
        stepSeconds: 100,
        rateWindow: "2m",
      })
    })

    it("resolves custom range with step <= 600 -> rateWindow 5m", () => {
      const bounds = resolveTimeRangeBounds({
        type: "custom",
        from: 0,
        to: 9000, // duration 9000, step = 300 <= 600
      })
      expect(bounds).toEqual({
        startSeconds: 0,
        endSeconds: 9000,
        stepSeconds: 300,
        rateWindow: "5m",
      })
    })

    it("resolves custom range with step <= 1800 -> rateWindow 15m", () => {
      const bounds = resolveTimeRangeBounds({
        type: "custom",
        from: 0,
        to: 36000, // duration 36000, step = 1200 <= 1800
      })
      expect(bounds).toEqual({
        startSeconds: 0,
        endSeconds: 36000,
        stepSeconds: 1200,
        rateWindow: "15m",
      })
    })

    it("resolves custom range with step > 1800 -> rateWindow 1h", () => {
      const bounds = resolveTimeRangeBounds({
        type: "custom",
        from: 0,
        to: 90000, // duration 90000, step = 3000 > 1800
      })
      expect(bounds).toEqual({
        startSeconds: 0,
        endSeconds: 90000,
        stepSeconds: 3000,
        rateWindow: "1h",
      })
    })
  })
})
