import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { NextRequest } from "next/server"

import { GET } from "./route"

describe("GET /[lang]/signup/start", () => {
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

  it("redirects legacy signup starts to login signup intent", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3300/id/signup/start?next=%2Fid%2Fconsole&provider=google"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3300/id/login/start?next=%2Fid%2Fconsole&provider=google&intent=signup"
    )
  })
})
