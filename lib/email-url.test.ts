import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { getEmailBaseUrl } from "./email-url"

describe("getEmailBaseUrl", () => {
  const originalAppUrl = process.env.APP_URL
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    }
  })

  it("prefers APP_URL when set", () => {
    process.env.APP_URL = "https://app.example.com"
    process.env.NEXT_PUBLIC_APP_URL = "https://public.example.com"
    expect(getEmailBaseUrl()).toBe("https://app.example.com")
  })

  it("falls back to NEXT_PUBLIC_APP_URL when APP_URL is unset", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://public.example.com"
    expect(getEmailBaseUrl()).toBe("https://public.example.com")
  })

  it("falls back to NEXT_PUBLIC_APP_URL when APP_URL is blank", () => {
    process.env.APP_URL = "   "
    process.env.NEXT_PUBLIC_APP_URL = "https://public.example.com"
    expect(getEmailBaseUrl()).toBe("https://public.example.com")
  })

  it("falls back to the local dev default when both are unset", () => {
    expect(getEmailBaseUrl()).toBe("http://localhost:3300")
  })
})
