import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

mock.module("@workos-inc/authkit-nextjs", () => ({
  authkit: mock(async () => ({
    session: { user: null },
    headers: new Headers(),
  })),
  handleAuthkitHeaders: mock(
    (_req: unknown, _headers: unknown, options?: { redirect?: string }) => {
      if (options?.redirect) {
        return NextResponse.redirect(
          new URL(options.redirect, "http://localhost:3300")
        )
      }
      return NextResponse.next()
    }
  ),
  partitionAuthkitHeaders: mock((_req: unknown, headers: unknown) => ({
    requestHeaders: (headers as Headers | undefined) || new Headers(),
  })),
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
})
