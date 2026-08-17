import { afterEach, describe, expect, it } from "bun:test"

import {
  getWorkOSLogoutReturnTo,
  getWorkOSPublicOrigin,
} from "@/lib/workos-redirect"

const originalPublicRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI

describe("WorkOS public redirect configuration", () => {
  afterEach(() => {
    if (originalPublicRedirectUri === undefined) {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
    } else {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = originalPublicRedirectUri
    }
  })

  it("builds a localized production logout URL from the public callback", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "https://pfnapp.my.id/callback"

    expect(getWorkOSPublicOrigin()).toBe("https://pfnapp.my.id")
    expect(getWorkOSLogoutReturnTo("en")).toBe("https://pfnapp.my.id/en/login")
    expect(getWorkOSLogoutReturnTo("id")).toBe("https://pfnapp.my.id/id/login")
  })

  it("keeps an explicitly configured localhost origin for local development", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "http://localhost:3300/callback"

    expect(getWorkOSLogoutReturnTo("en")).toBe("http://localhost:3300/en/login")
  })

  it("rejects unapproved redirect origins", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "https://evil.example/callback"

    expect(getWorkOSPublicOrigin()).toBeUndefined()
    expect(getWorkOSLogoutReturnTo("en")).toBeUndefined()
  })

  it("returns undefined when no redirect URI is configured", () => {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI

    expect(getWorkOSPublicOrigin()).toBeUndefined()
    expect(getWorkOSLogoutReturnTo("en")).toBeUndefined()
  })
})
