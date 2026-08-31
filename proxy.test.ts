import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

const mockAuthkit = mock(async () => ({
  session: { user: null },
  headers: new Headers(),
}))

const mockHandleAuthkitHeaders = mock(
  (_req: unknown, headers: Headers, options?: { redirect?: string }) => {
    const res = options?.redirect
      ? NextResponse.redirect(
          new URL(options.redirect, "http://localhost:3300")
        )
      : NextResponse.next()
    const setCookie = headers?.get("set-cookie")
    if (setCookie) {
      res.headers.set("set-cookie", setCookie)
    }
    return res
  }
)

const mockPartitionAuthkitHeaders = mock((_req: unknown, headers: Headers) => {
  const responseHeaders = new Headers()
  const setCookie = headers?.get("set-cookie")
  if (setCookie) {
    responseHeaders.set("set-cookie", setCookie)
  }
  return {
    requestHeaders: headers || new Headers(),
    responseHeaders,
  }
})

const mockApplyResponseHeaders = mock(
  (response: NextResponse, responseHeaders: Headers) => {
    for (const [key, val] of responseHeaders) {
      response.headers.set(key, val)
    }
    return response
  }
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  authkit: mockAuthkit,
  handleAuthkitHeaders: mockHandleAuthkitHeaders,
  partitionAuthkitHeaders: mockPartitionAuthkitHeaders,
  applyResponseHeaders: mockApplyResponseHeaders,
}))

import proxy from "./proxy"
describe("proxy middleware", () => {
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

  it("redirects unlocalized path using public proxy-safe origin when APP_URL is set", async () => {
    process.env.APP_URL = "https://pfnapp.id"
    const req = new NextRequest("http://0.0.0.0:3000/docs", {
      headers: {
        "accept-language": "id",
      },
    })
    const res = await proxy(req)
    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toBe("https://pfnapp.id/id/docs")
  })

  it("redirects unlocalized path preserving x-forwarded host and proto", async () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "pfnapp.id",
      "accept-language": "en",
    })
    const req = new NextRequest("http://0.0.0.0:3000/docs", { headers })
    const res = await proxy(req)
    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toBe("https://pfnapp.id/en/docs")
  })

  it("forwards Set-Cookie to response on /api requests when session refreshes", async () => {
    const authkitHeaders = new Headers()
    authkitHeaders.set(
      "set-cookie",
      "wos-session=refreshed_api_session; Path=/"
    )
    mockAuthkit.mockResolvedValueOnce({
      session: {
        user: { id: "user_api_123", email: "dev@example.com" },
        role: "user",
      },
      headers: authkitHeaders,
    })

    const req = new NextRequest("http://localhost:3300/api/whatsapp/templates")
    const res = await proxy(req)

    expect(res.headers.get("set-cookie")).toContain(
      "wos-session=refreshed_api_session"
    )
  })

  it("forwards Set-Cookie during unlocalized pathname redirect", async () => {
    const authkitHeaders = new Headers()
    authkitHeaders.set(
      "set-cookie",
      "wos-session=refreshed_redirect_session; Path=/"
    )
    mockAuthkit.mockResolvedValueOnce({
      session: {
        user: { id: "user_redir_123", email: "dev@example.com" },
        role: "user",
      },
      headers: authkitHeaders,
    })

    const req = new NextRequest("http://localhost:3300/console", {
      headers: {
        "accept-language": "en",
      },
    })
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3300/en/console")
    expect(res.headers.get("set-cookie")).toContain(
      "wos-session=refreshed_redirect_session"
    )
  })
})
