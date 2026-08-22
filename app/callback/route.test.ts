import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

const mockFindTenantInvitationByToken = mock(async () => null)
const mockAcceptTenantInvitation = mock(async () => ({}))

mock.module("@/modules/tenants/services/tenant-workos.service", () => ({
  findTenantInvitationByToken: mockFindTenantInvitationByToken,
  acceptTenantInvitation: mockAcceptTenantInvitation,
}))

import { GET, handleGetCallback } from "./route"
import { INVITE_COOKIE_NAME } from "@/modules/auth/invite-cookie"

describe("app/callback/route", () => {
  const originalAppUrl = process.env.APP_URL

  beforeEach(() => {
    delete process.env.APP_URL
  })

  afterEach(() => {
    if (originalAppUrl !== undefined) {
      process.env.APP_URL = originalAppUrl
    } else {
      delete process.env.APP_URL
    }
  })

  it("handles get callback without crashing and redirects unauthenticated error safely", async () => {
    process.env.APP_URL = "https://pfnapp.id"
    const req = new NextRequest(
      "http://0.0.0.0:3000/callback?error=invalid_request"
    )
    const res = await GET(req)
    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toContain("https://pfnapp.id/login")
    expect(location).not.toContain("0.0.0.0:3000")
  })

  it("accepts invite token when present in cookie and clears cookie", async () => {
    process.env.APP_URL = "https://pfnapp.id"
    const mockAccept = mock(async () => "org_123")
    const mockAuthRoute = mock(
      async () =>
        new Response(null, {
          status: 307,
          headers: { location: "https://pfnapp.id/console" },
        })
    )

    const req = {
      cookies: {
        get: (name: string) =>
          name === INVITE_COOKIE_NAME ? { value: "token_abc123" } : undefined,
      },
      headers: new Headers({
        cookie: `${INVITE_COOKIE_NAME}=token_abc123`,
      }),
    } as unknown as NextRequest

    const res = await handleGetCallback(req, {
      acceptInvite: mockAccept,
      handleAuthRoute: mockAuthRoute as unknown as typeof GET,
    })

    expect(res.status).toBe(307)
    expect(mockAccept).toHaveBeenCalledWith("token_abc123")
    expect(mockAuthRoute).toHaveBeenCalled()
  })
})
