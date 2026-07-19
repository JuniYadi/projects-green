import { describe, expect, it, mock } from "bun:test"

// ─── Mock modules before any imports ─────────────────────────────────────────

mock.module("next/navigation", () => ({
  redirect: mock((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/${opts.locale}${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

// ─── Dynamic imports after mocks ─────────────────────────────────────────────

const { default: ManagePage } =
  await import("@/app/[lang]/console/app/manage/page")

describe("ManagePage redirect", () => {
  it("redirects /console/app/manage to /console/app", async () => {
    try {
      await ManagePage({ params: Promise.resolve({ lang: "en" }) })
      expect.unreachable("Expected redirect to be thrown")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain("REDIRECT:/en/console/app")
    }
  })

  it("honors the locale parameter", async () => {
    try {
      await ManagePage({ params: Promise.resolve({ lang: "id" }) })
      expect.unreachable("Expected redirect to be thrown")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain("REDIRECT:/id/console/app")
    }
  })
})
