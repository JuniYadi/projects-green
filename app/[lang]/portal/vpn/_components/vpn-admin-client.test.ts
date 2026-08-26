import { describe, it, expect } from "bun:test"
import { extractErrorMessage } from "./vpn-admin-client"

describe("extractErrorMessage", () => {
  it("returns fallback for falsy or empty values", () => {
    expect(extractErrorMessage(null)).toBe("Request failed")
    expect(extractErrorMessage(undefined)).toBe("Request failed")
    expect(extractErrorMessage("")).toBe("Request failed")
  })

  it("handles string error", () => {
    expect(extractErrorMessage("Network error")).toBe("Network error")
  })

  it("handles error object with message", () => {
    expect(extractErrorMessage({ message: "Server not found" })).toBe(
      "Server not found"
    )
  })

  it("handles error object with value.message", () => {
    expect(extractErrorMessage({ value: { message: "Invalid payload" } })).toBe(
      "Invalid payload"
    )
  })

  it("handles error object with value.error", () => {
    expect(extractErrorMessage({ value: { error: "Validation failed" } })).toBe(
      "Validation failed"
    )
  })

  it("handles error object with error field", () => {
    expect(extractErrorMessage({ error: "Unauthorized" })).toBe("Unauthorized")
  })

  it("handles error object with statusText", () => {
    expect(
      extractErrorMessage({ status: 500, statusText: "Internal Server Error" })
    ).toBe("Internal Server Error")
  })

  it("handles JSON serialization fallback", () => {
    expect(extractErrorMessage({ code: 400, details: { field: "name" } })).toBe(
      '{"code":400,"details":{"field":"name"}}'
    )
  })
})
