import { describe, expect, it } from "bun:test"

import { resolveRequestLocale } from "@/lib/i18n/request-locale"

describe("request locale resolution", () => {
  it("uses cookie locale when available", () => {
    expect(
      resolveRequestLocale({
        acceptLanguageHeader: "en-US,en;q=0.8",
        cookieLocale: "id",
      })
    ).toBe("id")
  })

  it("falls back to default English when cookie is unknown", () => {
    expect(
      resolveRequestLocale({
        acceptLanguageHeader: undefined,
        cookieLocale: "fr",
      })
    ).toBe("en")
  })

  it("matches Indonesian from Accept-Language", () => {
    expect(
      resolveRequestLocale({
        acceptLanguageHeader: "id-ID,id;q=0.9,en;q=0.8",
        cookieLocale: undefined,
      })
    ).toBe("id")
  })

  it("falls back to default English for wildcard Accept-Language", () => {
    expect(
      resolveRequestLocale({
        acceptLanguageHeader: "*",
        cookieLocale: undefined,
      })
    ).toBe("en")
  })
})
