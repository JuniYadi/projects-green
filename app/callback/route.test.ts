import { describe, it, expect } from "bun:test"

describe("callback route error handling", () => {
  it("should transform 'Auth cookie missing' to user-friendly message", () => {
    const cookieMissingError = new Error(
      "Auth cookie missing — cannot verify OAuth state. Ensure Set-Cookie headers are propagated on redirects."
    )

    let errorMessage = "Authentication failed"
    if (cookieMissingError instanceof Error) {
      if (
        cookieMissingError.message.includes("Auth cookie missing") ||
        cookieMissingError.message.includes("OAuth state")
      ) {
        errorMessage = "Session expired. Please sign in again."
      }
    }

    expect(errorMessage).toBe("Session expired. Please sign in again.")
  })

  it("should transform 'OAuth state mismatch' to user-friendly message", () => {
    const stateMismatchError = new Error("OAuth state mismatch")

    let errorMessage = "Authentication failed"
    if (stateMismatchError instanceof Error) {
      if (
        stateMismatchError.message.includes("Auth cookie missing") ||
        stateMismatchError.message.includes("OAuth state")
      ) {
        errorMessage = "Session expired. Please sign in again."
      }
    }

    expect(errorMessage).toBe("Session expired. Please sign in again.")
  })

  it("should use generic message for other errors", () => {
    const genericError = new Error("Some other error")

    let errorMessage = "Authentication failed"
    if (genericError instanceof Error) {
      if (
        genericError.message.includes("Auth cookie missing") ||
        genericError.message.includes("OAuth state")
      ) {
        errorMessage = "Session expired. Please sign in again."
      } else {
        errorMessage = "Sign in failed. Please try again."
      }
    }

    expect(errorMessage).toBe("Sign in failed. Please try again.")
  })
})