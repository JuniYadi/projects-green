import { describe, expect, it } from "bun:test"

import { parseStepQueryValue } from "@/modules/deploy/deploy.constants"

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
