import { describe, expect, it } from "bun:test"
import {
  clearFieldError,
  resolveCreateExceptionMessage,
  resolveCreateFailureState,
} from "@/app/[lang]/portal/billing/voucher/voucher-create-errors"

describe("clearFieldError", () => {
  it("removes only the edited key and leaves others", () => {
    const errors = { prefix: ["required"], amount: ["must be positive"] }
    const next = clearFieldError(errors, "prefix")
    expect(next).toEqual({ amount: ["must be positive"] })
    expect(next).not.toBe(errors)
  })

  it("returns the same reference when the key is absent", () => {
    const errors = { amount: ["must be positive"] }
    expect(clearFieldError(errors, "prefix")).toBe(errors)
  })

  it("returns an empty object when the last key is cleared", () => {
    const errors = { prefix: ["required"] }
    expect(clearFieldError(errors, "prefix")).toEqual({})
  })
})

describe("resolveCreateFailureState", () => {
  it("returns fieldErrors and null banner when API error has non-empty fieldErrors", () => {
    const result = resolveCreateFailureState({
      message: "Validation failed",
      fieldErrors: { prefix: ["required"] },
    })
    expect(result.fieldErrors).toEqual({ prefix: ["required"] })
    expect(result.createError).toBeNull()
  })

  it("returns fieldErrors with null banner when fieldErrors is present without message", () => {
    const result = resolveCreateFailureState({
      fieldErrors: { prefix: ["required"] },
    })
    expect(result.fieldErrors).toEqual({ prefix: ["required"] })
    expect(result.createError).toBeNull()
  })

  it("returns banner message when message is provided and no fieldErrors", () => {
    const result = resolveCreateFailureState({ message: "Server down" })
    expect(result.fieldErrors).toEqual({})
    expect(result.createError).toBe("Server down")
  })

  it("returns banner message when fieldErrors is an empty object", () => {
    const result = resolveCreateFailureState({
      message: "Bad request",
      fieldErrors: {},
    })
    expect(result.fieldErrors).toEqual({})
    expect(result.createError).toBe("Bad request")
  })

  it("falls back to default banner when err is null/undefined or has no message", () => {
    expect(resolveCreateFailureState(null)).toEqual({
      fieldErrors: {},
      createError: "Failed to create voucher",
    })
    expect(resolveCreateFailureState(undefined)).toEqual({
      fieldErrors: {},
      createError: "Failed to create voucher",
    })
    expect(resolveCreateFailureState({})).toEqual({
      fieldErrors: {},
      createError: "Failed to create voucher",
    })
  })
})

describe("resolveCreateExceptionMessage", () => {
  it("returns the message from an Error instance", () => {
    expect(resolveCreateExceptionMessage(new Error("boom"))).toBe("boom")
  })

  it("returns the default message for non-Error values", () => {
    expect(resolveCreateExceptionMessage("oops")).toBe(
      "An unexpected error occurred"
    )
    expect(resolveCreateExceptionMessage({})).toBe(
      "An unexpected error occurred"
    )
    expect(resolveCreateExceptionMessage(null)).toBe(
      "An unexpected error occurred"
    )
  })
})
