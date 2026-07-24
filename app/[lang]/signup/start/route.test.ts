import { describe, expect, it } from "bun:test"
import { NextRequest } from "next/server"

import { GET } from "./route"

describe("GET /[lang]/signup/start", () => {
  it("redirects legacy signup starts to login signup intent", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/id/signup/start?next=%2Fid%2Fconsole&provider=google"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/id/login/start?next=%2Fid%2Fconsole&provider=google&intent=signup"
    )
  })
})
