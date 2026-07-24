import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

const mockGetSignInUrl = mock(() =>
  Promise.resolve("https://auth.test/authorize?screen_hint=sign-in")
)
const mockGetSignUpUrl = mock(() =>
  Promise.resolve("https://auth.test/authorize?screen_hint=sign-up")
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  getSignInUrl: mockGetSignInUrl,
  getSignUpUrl: mockGetSignUpUrl,
}))

mock.module("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}))

const { GET } = await import("./route")
const originalPublicRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
const originalRedirectUri = process.env.WORKOS_REDIRECT_URI

describe("GET /[lang]/login/start", () => {
  beforeEach(() => {
    mockGetSignInUrl.mockClear()
    mockGetSignUpUrl.mockClear()
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
    delete process.env.WORKOS_REDIRECT_URI
  })

  afterAll(() => {
    if (originalPublicRedirectUri === undefined) {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
    } else {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = originalPublicRedirectUri
    }
    if (originalRedirectUri === undefined) {
      delete process.env.WORKOS_REDIRECT_URI
    } else {
      process.env.WORKOS_REDIRECT_URI = originalRedirectUri
    }
  })

  it("starts WorkOS sign-in by default", async () => {
    await GET(
      new NextRequest("http://localhost/id/login/start?next=%2Fid%2Fconsole")
    )

    expect(mockGetSignInUrl).toHaveBeenCalledWith({
      returnTo: "/id/console",
      redirectUri: undefined,
    })
    expect(mockGetSignUpUrl).not.toHaveBeenCalled()
  })

  it("starts WorkOS sign-up for signup intent", async () => {
    await GET(
      new NextRequest(
        "http://localhost/id/login/start?intent=signup&next=%2Fid%2Fconsole"
      )
    )

    expect(mockGetSignUpUrl).toHaveBeenCalledWith({
      returnTo: "/id/console",
      redirectUri: undefined,
    })
    expect(mockGetSignInUrl).not.toHaveBeenCalled()
  })

  it("rejects a protocol-relative next path", async () => {
    await GET(
      new NextRequest(
        "http://localhost/id/login/start?intent=signup&next=%2F%2Fevil.test"
      )
    )

    expect(mockGetSignUpUrl).toHaveBeenCalledWith({
      returnTo: "/",
      redirectUri: undefined,
    })
  })

  it("sets a provider and removes the screen hint", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/id/login/start?intent=signup&provider=google"
      )
    )
    const location = new URL(response.headers.get("location")!)

    expect(location.searchParams.get("provider")).toBe("GoogleOAuth")
    expect(location.searchParams.has("screen_hint")).toBe(false)
  })
})
