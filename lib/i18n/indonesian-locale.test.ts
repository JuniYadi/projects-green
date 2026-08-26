import { describe, expect, it } from "bun:test"

import {
  buildLocalizedPath,
  buildLocaleCookie,
  getBrowserLocaleDetails,
  indonesianLocalePreferenceStorageKey,
  isIndonesiaLikely,
  readIndonesianLocalePreference,
  shouldRunIndonesianLocaleCue,
  shouldShowIndonesianLocalePrompt,
  writeIndonesianLocalePreference,
} from "@/lib/i18n/indonesian-locale"

const createStorage = () => {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe("Indonesian locale preference", () => {
  it("uses browser language before considering the limited timezone hint", () => {
    expect(
      isIndonesiaLikely({
        languages: ["id-ID", "en-US"],
        language: "en-US",
      })
    ).toBe(true)
    expect(
      isIndonesiaLikely({
        languages: ["en-US"],
        language: "id",
      })
    ).toBe(true)
    expect(
      isIndonesiaLikely({
        languages: ["en-US"],
        language: "en-US",
        timeZone: "Asia/Jakarta",
      })
    ).toBe(true)
    expect(
      isIndonesiaLikely({
        languages: ["id-GB"],
        language: "en-US",
        timeZone: "Europe/London",
      })
    ).toBe(false)
  })

  it("accepts only the approved Indonesian timezone hints", () => {
    expect(isIndonesiaLikely({ timeZone: "Asia/Makassar" })).toBe(true)
    expect(isIndonesiaLikely({ timeZone: "Asia/Jayapura" })).toBe(true)
    expect(isIndonesiaLikely({ timeZone: "Asia/Bangkok" })).toBe(false)
  })

  it("does not read a timezone when browser language is already decisive", () => {
    const originalDateTimeFormat = Intl.DateTimeFormat
    const originalLanguages = navigator.languages
    const originalLanguage = navigator.language
    const dateTimeFormat = () => {
      throw new Error("timezone should not be read")
    }

    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["id-ID"],
    })
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "id-ID",
    })
    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      value: dateTimeFormat,
    })

    expect(getBrowserLocaleDetails()).toEqual({
      languages: ["id-ID"],
      language: "id-ID",
    })

    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: originalLanguages,
    })
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: originalLanguage,
    })
    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      value: originalDateTimeFormat,
    })
  })

  it("reads and writes only the versioned local decision schema", () => {
    const storage = createStorage()

    expect(
      writeIndonesianLocalePreference({
        storage,
        decision: "stay",
      })
    ).toBe(true)
    expect(readIndonesianLocalePreference(storage)).toEqual({
      version: 1,
      decision: "stay",
      cueShown: false,
    })

    storage.setItem(indonesianLocalePreferenceStorageKey, "not-json")
    expect(readIndonesianLocalePreference(storage)).toBeNull()
  })

  it("fails safely when local storage is unavailable", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }

    expect(readIndonesianLocalePreference(unavailableStorage)).toBeNull()
    expect(
      writeIndonesianLocalePreference({
        storage: unavailableStorage,
        decision: "switch",
      })
    ).toBe(false)
  })

  it("only prompts English routes with no current-version decision", () => {
    expect(
      shouldShowIndonesianLocalePrompt({
        locale: "en",
        preference: null,
        browserDetails: { language: "id-ID" },
      })
    ).toBe(true)
    expect(
      shouldShowIndonesianLocalePrompt({
        locale: "id",
        preference: null,
        browserDetails: { language: "id-ID" },
      })
    ).toBe(false)
    expect(
      shouldShowIndonesianLocalePrompt({
        locale: "en",
        preference: { version: 1, decision: "stay", cueShown: false },
        browserDetails: { language: "id-ID" },
      })
    ).toBe(false)
  })

  it("preserves path and query while using the established pathname helper", () => {
    expect(
      buildLocalizedPath({
        pathname: "/en/console/apps",
        search: "tab=logs&from=language-control",
        locale: "id",
      })
    ).toBe("/id/console/apps?tab=logs&from=language-control")
  })

  it("uses the established NEXT_LOCALE preference cookie", () => {
    expect(buildLocaleCookie("id")).toBe("NEXT_LOCALE=id; Path=/; SameSite=Lax")
  })

  it("only gates a cue for an unshown current-version decision", () => {
    expect(shouldRunIndonesianLocaleCue(null)).toBe(false)
    expect(
      shouldRunIndonesianLocaleCue({
        version: 1,
        decision: "switch",
        cueShown: false,
      })
    ).toBe(true)
    expect(
      shouldRunIndonesianLocaleCue({
        version: 1,
        decision: "switch",
        cueShown: true,
      })
    ).toBe(false)
  })
})
