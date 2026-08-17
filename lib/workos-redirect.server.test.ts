import { afterEach, describe, expect, it } from "bun:test"

import { getWorkOSRedirectUri } from "@/lib/workos-redirect.server"

const originalPublicRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
const originalRedirectUri = process.env.WORKOS_REDIRECT_URI

describe("WorkOS server redirect configuration", () => {
  afterEach(() => {
    if (originalPublicRedirectUri === undefined) {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
    } else {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = originalPublicRedirectUri
    }
    if (originalRedirectUri === undefined) {
      delete process.env.WORKOS_REDIRECT_URI
    } else {
      process.env.WORKOS_REDIRECT_URI = originalRedirectUri
    }
  })

  it("prefers the runtime value over the public build value", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "http://localhost:3300/callback"
    process.env.WORKOS_REDIRECT_URI = "https://pfnapp.my.id/callback"

    expect(getWorkOSRedirectUri()).toBe("https://pfnapp.my.id/callback")
  })

  it("falls back to the explicitly configured public value", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "https://pfnapp.my.id/callback"
    delete process.env.WORKOS_REDIRECT_URI

    expect(getWorkOSRedirectUri()).toBe("https://pfnapp.my.id/callback")
  })
})
