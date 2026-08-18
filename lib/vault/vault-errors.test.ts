import { describe, expect, it } from "bun:test"

import {
  VaultAuthError,
  VaultError,
  VaultNetworkError,
  VaultSecretNotFoundError,
} from "./vault-errors"

describe("Vault errors", () => {
  it("preserves typed names, status, and causes", () => {
    const cause = new Error("offline")
    const error = new VaultNetworkError("Vault unavailable", {
      cause,
      status: 503,
    })

    expect(error).toBeInstanceOf(VaultError)
    expect(error.name).toBe("VaultNetworkError")
    expect(error.status).toBe(503)
    expect(error.cause).toBe(cause)
  })

  it("exposes the authentication and not-found error types", () => {
    expect(new VaultAuthError("denied")).toBeInstanceOf(VaultError)
    expect(new VaultSecretNotFoundError("missing")).toBeInstanceOf(VaultError)
  })
})
