import { describe, expect, it } from "bun:test"

import {
  getLocaleFromPathname,
  getPathnameWithoutLocale,
  localizePathname,
  resolveLocaleOrDefault,
} from "@/lib/i18n/pathname"

describe("i18n pathname helpers", () => {
  it("extracts locale and logical pathname", () => {
    expect(getLocaleFromPathname("/id/console/app/deploy")).toEqual({
      locale: "id",
      pathnameWithoutLocale: "/console/app/deploy",
    })
  })

  it("returns null locale when path is not prefixed", () => {
    expect(getLocaleFromPathname("/console")).toEqual({
      locale: null,
      pathnameWithoutLocale: "/console",
    })
  })

  it("strips dynamic locale route segment from pathname templates", () => {
    expect(getLocaleFromPathname("/[lang]/console/support-tickets")).toEqual({
      locale: null,
      pathnameWithoutLocale: "/console/support-tickets",
    })
  })

  it("normalizes pathname without leading slash", () => {
    expect(getLocaleFromPathname("console")).toEqual({
      locale: null,
      pathnameWithoutLocale: "/console",
    })
  })

  it("handles dot-slash pathname", () => {
    expect(getLocaleFromPathname("/")).toEqual({
      locale: null,
      pathnameWithoutLocale: "/",
    })
  })

  it("localizes root path to locale-only path", () => {
    expect(
      localizePathname({
        pathname: "/",
        locale: "id",
      })
    ).toBe("/id")
  })

  it("replaces existing locale when localizing pathname", () => {
    expect(
      localizePathname({
        pathname: "/id/portal/documentations",
        locale: "en",
      })
    ).toBe("/en/portal/documentations")
  })

  it("getPathnameWithoutLocale strips the locale prefix", () => {
    expect(getPathnameWithoutLocale("/id/dashboard")).toBe("/dashboard")
  })

  it("getPathnameWithoutLocale returns unchanged path when no locale", () => {
    expect(getPathnameWithoutLocale("/dashboard")).toBe("/dashboard")
  })
})

describe("resolveLocaleOrDefault", () => {
  it("returns the locale when valid", () => {
    expect(resolveLocaleOrDefault("en")).toBe("en")
    expect(resolveLocaleOrDefault("id")).toBe("id")
  })

  it("returns default locale when value is null", () => {
    expect(resolveLocaleOrDefault(null)).toBe("en")
  })

  it("returns default locale when value is undefined", () => {
    expect(resolveLocaleOrDefault(undefined)).toBe("en")
  })

  it("returns default locale when value is invalid", () => {
    expect(resolveLocaleOrDefault("fr")).toBe("en")
  })
})
