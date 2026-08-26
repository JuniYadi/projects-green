import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { getMessages } from "@/lib/i18n/messages"
import {
  indonesianLocalePreferenceStorageKey,
  writeIndonesianLocalePreference,
} from "@/lib/i18n/indonesian-locale"

const replace = mock(() => {})
const runIndonesianLocaleCue = mock(async () => null)
let pathname = "/en/console/apps"
let searchParams = new URLSearchParams("tab=logs")

mock.module("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}))

mock.module("@/lib/i18n/indonesian-locale-cue", () => ({
  runIndonesianLocaleCue,
}))

const { IndonesianLocaleControl } =
  await import("@/components/indonesian-locale-control")

describe("IndonesianLocaleControl", () => {
  beforeEach(() => {
    replace.mockClear()
    runIndonesianLocaleCue.mockClear()
    window.localStorage.clear()
    document.cookie = "NEXT_LOCALE=; Path=/; Max-Age=0"
    pathname = "/en/console/apps"
    searchParams = new URLSearchParams("tab=logs")
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["id-ID", "en-US"],
    })
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "id-ID",
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("offers stay or switch once on Indonesia-likely English routes", async () => {
    const view = render(
      <IndonesianLocaleControl
        locale="en"
        messages={getMessages("en").indonesianLocale}
      />
    )

    expect(await view.findByText("Continue in Indonesian?")).toBeVisible()
    fireEvent.click(view.getByRole("button", { name: "Stay in English" }))

    await waitFor(() => {
      expect(runIndonesianLocaleCue).toHaveBeenCalledTimes(1)
    })
    expect(
      JSON.parse(
        window.localStorage.getItem(indonesianLocalePreferenceStorageKey) ||
          "{}"
      )
    ).toEqual({ version: 1, decision: "stay", cueShown: true })
    expect(view.queryByText("Continue in Indonesian?")).not.toBeInTheDocument()
  })

  it("redirects only after an explicit switch decision and preserves query", async () => {
    const view = render(
      <IndonesianLocaleControl
        locale="en"
        messages={getMessages("en").indonesianLocale}
      />
    )

    fireEvent.click(await view.findByRole("button", { name: "Use Indonesian" }))

    expect(replace).toHaveBeenCalledWith("/id/console/apps?tab=logs")
  })

  it("does not repeat the offer when a current-version decision exists", async () => {
    writeIndonesianLocalePreference({
      storage: window.localStorage,
      decision: "stay",
      cueShown: true,
    })

    const view = render(
      <IndonesianLocaleControl
        locale="en"
        messages={getMessages("en").indonesianLocale}
      />
    )

    expect(view.queryByText("Continue in Indonesian?")).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
