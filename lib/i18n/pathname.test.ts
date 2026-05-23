import { describe, expect, it } from "bun:test"

import {
  getLocaleFromPathname,
  localizePathname,
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

  it("replaces existing locale when localizing pathname", () => {
    expect(
      localizePathname({
        pathname: "/id/portal/documentations",
        locale: "en",
      })
    ).toBe("/en/portal/documentations")
  })
})
