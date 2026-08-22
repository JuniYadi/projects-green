import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { NextRequest } from "next/server"

import { GET } from "./route"

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
})
