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
    expect(parseStepQueryValue("build")).toBe("build")
    expect(parseStepQueryValue("environment")).toBe("environment")
    expect(parseStepQueryValue("monitor")).toBe("monitor")
  })
})
