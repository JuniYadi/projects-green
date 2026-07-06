import { afterEach, beforeEach, describe, expect, it } from "bun:test"

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
  })

  it("prefers browser origin over env var when window origin is a real origin", async () => {
    const happyDOM = (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM
    happyDOM.setURL(
      "https://pgreen.tunnel.juniyadi.id/id/console/whatsapp/devices/dev_1"
    )

    // Dynamic import avoids caching the @/lib/eden module (which constructs the
    // eden singleton) in the shared process, preventing cross-file cache pollution.
    const { getApiBaseUrl } = await import("@/lib/eden")

    expect(getApiBaseUrl()).toBe("https://pgreen.tunnel.juniyadi.id")
  })

  it("falls back to env var when window origin is null (about:blank)", async () => {
    const happyDOM = (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM
    happyDOM.setURL("about:blank")
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300/"

    const { getApiBaseUrl } = await import("@/lib/eden")

    expect(getApiBaseUrl()).toBe("http://localhost:3300")
  })
})
