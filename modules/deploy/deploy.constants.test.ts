import { describe, expect, it } from "bun:test"

import {
  parseStepQueryValue,
  resolveContainerLimits,
} from "@/modules/deploy/deploy.constants"

describe("parseStepQueryValue", () => {
  it("returns source when query step is missing or invalid", () => {
    expect(parseStepQueryValue(null)).toBe("source")
    expect(parseStepQueryValue(undefined)).toBe("source")
    expect(parseStepQueryValue("unknown")).toBe("source")
  })

  it("returns the requested step when valid", () => {
    expect(parseStepQueryValue("source")).toBe("source")
    expect(parseStepQueryValue("connect")).toBe("connect")
    expect(parseStepQueryValue("detect")).toBe("detect")
    expect(parseStepQueryValue("review")).toBe("review")
    expect(parseStepQueryValue("deploy")).toBe("deploy")
    expect(parseStepQueryValue("build")).toBe("detect")
    expect(parseStepQueryValue("environment")).toBe("review")
    expect(parseStepQueryValue("monitor")).toBe("deploy")
  })
})

describe("resolveContainerLimits", () => {
  it("mirrors the plan's own request instead of padding it to a ceiling", () => {
    expect(resolveContainerLimits(1000, 2048)).toEqual({
      cpuMillicores: 1000,
      memoryMi: 2048,
    })
    expect(resolveContainerLimits(100, 256)).toEqual({
      cpuMillicores: 100,
      memoryMi: 256,
    })
  })

  it("falls back to the builder's own defaults when a stack has no plan values", () => {
    expect(resolveContainerLimits(null, null)).toEqual({
      cpuMillicores: 500,
      memoryMi: 1024,
    })
    expect(resolveContainerLimits(undefined, undefined)).toEqual({
      cpuMillicores: 500,
      memoryMi: 1024,
    })
  })
})
