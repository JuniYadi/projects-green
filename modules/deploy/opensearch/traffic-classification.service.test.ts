import { describe, it, expect } from "bun:test"
import { classifyTraffic } from "./traffic-classification.service"

describe("traffic-classification.service", () => {
  it("classifies clean, mostly-2xx, mostly-browser traffic as likely_human", () => {
    const result = classifyTraffic({
      totalRequests: 100,
      automatedUaRequests: 2,
      successRequests: 95,
      errorRequests: 5,
      probePathRequests: 0,
    })
    expect(result.label).toBe("likely_human")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it("classifies bot-UA-heavy traffic hitting probe paths as likely_automated", () => {
    const result = classifyTraffic({
      totalRequests: 50,
      automatedUaRequests: 45,
      successRequests: 5,
      errorRequests: 45,
      probePathRequests: 10,
    })
    expect(result.label).toBe("likely_automated")
    expect(result.confidence).toBeGreaterThanOrEqual(70)
  })

  it("classifies conflicting evidence (probe-path hits + otherwise clean human navigation) as mixed", () => {
    const result = classifyTraffic({
      totalRequests: 100,
      automatedUaRequests: 5, // ratio 0.05, well under the automated-UA threshold
      successRequests: 95, // ratio 0.95, triggers the human-navigation signal
      errorRequests: 5,
      probePathRequests: 15, // ratio 0.15, triggers the probe-path signal on its own
    })
    expect(result.label).toBe("mixed")
  })

  it("returns unknown for too few requests instead of guessing", () => {
    const result = classifyTraffic({
      totalRequests: 2,
      automatedUaRequests: 2,
      successRequests: 0,
      errorRequests: 2,
      probePathRequests: 0,
    })
    expect(result.label).toBe("unknown")
    expect(result.confidence).toBe(0)
  })

  it("returns unknown rather than likely_automated on a single weak signal (high error ratio alone)", () => {
    const result = classifyTraffic({
      totalRequests: 20,
      automatedUaRequests: 0,
      successRequests: 8,
      errorRequests: 12, // 60% error, but no automated-UA or probe corroboration
      probePathRequests: 0,
    })
    expect(result.label).toBe("unknown")
    expect(result.reasons.some((r) => r.includes("error"))).toBe(true)
  })

  it("is deterministic: same input always produces the same output", () => {
    const input = {
      totalRequests: 40,
      automatedUaRequests: 5,
      successRequests: 38,
      errorRequests: 2,
      probePathRequests: 0,
    }
    expect(classifyTraffic(input)).toEqual(classifyTraffic(input))
  })
})
