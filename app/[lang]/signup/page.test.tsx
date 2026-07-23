import { describe, expect, it, mock } from "bun:test"

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

const { default: SignupPage } = await import("./page")

const expectRedirect = async (next?: string) => {
  try {
    await SignupPage({
      params: Promise.resolve({ lang: "id" }),
      searchParams: Promise.resolve(next ? { next } : {}),
    })
    expect.unreachable("Expected redirect to be thrown")
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

describe("SignupPage", () => {
  it("redirects to localized WorkOS signup by default", async () => {
    expect(await expectRedirect()).toBe(
      "REDIRECT:/id/login/start?intent=signup&next=%2Fid%2Fconsole"
    )
  })

  it("preserves a safe next path", async () => {
    expect(await expectRedirect("/id/portal")).toBe(
      "REDIRECT:/id/login/start?intent=signup&next=%2Fid%2Fportal"
    )
  })

  it("rejects a protocol-relative next path", async () => {
    expect(await expectRedirect("//evil.test")).toBe(
      "REDIRECT:/id/login/start?intent=signup&next=%2Fid%2Fconsole"
    )
  })
})
