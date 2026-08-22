import { describe, expect, it } from "bun:test"
import { NextRequest } from "next/server"

import {
  buildClearInviteCookieHeader,
  buildInviteCookieHeader,
  INVITE_COOKIE_NAME,
} from "./invite-cookie"

describe("invite-cookie", () => {
  it("builds cookie header with Secure for https", () => {
    const header = buildInviteCookieHeader(
      "test-token",
      "https://pfnapp.id/callback"
    )
    expect(header).toContain(`${INVITE_COOKIE_NAME}=test-token`)
    expect(header).toContain("Secure")
  })

  it("builds cookie header with Secure when request has x-forwarded-proto https", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
    })
    const req = new NextRequest("http://0.0.0.0:3000/callback", { headers })
    const header = buildInviteCookieHeader("test-token", req)
    expect(header).toContain("Secure")
  })

  it("builds clear invite cookie header with Secure when request is secure", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
    })
    const req = new NextRequest("http://0.0.0.0:3000/callback", { headers })
    const header = buildClearInviteCookieHeader(req)
    expect(header).toContain("Max-Age=0")
    expect(header).toContain("Secure")
  })
})
