import { describe, expect, it, mock } from "bun:test"

// ─── Mock modules before any imports ─────────────────────────────────────────

mock.module("next/navigation", () => ({
  redirect: mock((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

// ─── Dynamic imports after mocks ─────────────────────────────────────────────

const { default: NewCredentialPage } =
  await import("@/app/[lang]/console/app/credentials/new/page")

describe("NewCredentialPage redirect", () => {
  it("redirects /console/app/credentials/new to /console/app/credentials?action=new", async () => {
    try {
      await NewCredentialPage({ params: Promise.resolve({ lang: "en" }) })
      expect.unreachable("Expected redirect to be thrown")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain(
        "REDIRECT:/en/console/app/credentials?action=new"
      )
    }
  })

  it("honors the locale parameter", async () => {
    try {
      await NewCredentialPage({ params: Promise.resolve({ lang: "id" }) })
      expect.unreachable("Expected redirect to be thrown")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain(
        "REDIRECT:/id/console/app/credentials?action=new"
      )
    }
  })
})
