import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { NextRequest } from "next/server"

import { getRequestOrigin, getRequestUrl, isSecureRequest } from "./request-url"

describe("request-url utils", () => {
  const originalAppUrl = process.env.APP_URL
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    if (originalAppUrl !== undefined) {
      process.env.APP_URL = originalAppUrl
    } else {
      delete process.env.APP_URL
    }
    if (originalNextPublicAppUrl !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL
    }
  })

  it("prefers APP_URL when configured", () => {
    process.env.APP_URL = "https://pfnapp.id"
    const req = new NextRequest("http://0.0.0.0:3000/callback")
    expect(getRequestOrigin(req)).toBe("https://pfnapp.id")
    expect(getRequestUrl("/login", req).toString()).toBe(
      "https://pfnapp.id/login"
    )
  })

  it("extracts forwarded host and proto when behind reverse proxy", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "pfnapp.id",
    })
    const req = new NextRequest("http://0.0.0.0:3000/callback", { headers })
    expect(getRequestOrigin(req)).toBe("https://pfnapp.id")
    expect(getRequestUrl("/login?error=test", req).toString()).toBe(
      "https://pfnapp.id/login?error=test"
    )
    expect(isSecureRequest(req)).toBe(true)
  })

  it("identifies secure request when forwarded-proto is https", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
    })
    const req = new NextRequest("http://0.0.0.0:3000/callback", { headers })
    expect(isSecureRequest(req)).toBe(true)
  })
})
