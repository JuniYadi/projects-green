import { describe, expect, it } from "bun:test"
import { formatKey } from "./format-key"

describe("formatKey", () => {
  it("formats camelCase to Title Case", () => {
    expect(formatKey("phoneNumber")).toBe("Phone Number")
    expect(formatKey("dailyPerDevice")).toBe("Daily Per Device")
    expect(formatKey("enableFeatureABC")).toBe("Enable Feature A B C")
  })

  it("formats snake_case to Title Case", () => {
    expect(formatKey("phone_number")).toBe("Phone number")
    expect(formatKey("daily_quota_in")).toBe("Daily quota in")
  })
})
