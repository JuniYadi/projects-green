import { beforeEach, describe, expect, it, mock } from "bun:test"

type AuthResponse = {
  user: {
    id: string
    lastSignInAt: string | null
  } | null
}

const mockWithAuth = mock(
  async (): Promise<AuthResponse> => ({
    user: {
      id: "user_123",
      lastSignInAt: "2026-05-20T05:00:00.000Z",
    },
  })
)
const mockCookieGet = mock(() => ({
  value: "sealed_cookie",
}))
const mockCookies = mock(async () => ({
  get: mockCookieGet,
}))
const mockUnsealData = mock(async () => ({
  authenticationMethod: "GoogleOAuth",
}))

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: mockWithAuth,
  }
})

mock.module("next/headers", () => {
  return {
    cookies: mockCookies,
  }
})

mock.module("iron-session", () => {
  return {
    unsealData: mockUnsealData,
  }
})

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockCookieGet.mockClear()
    mockCookies.mockClear()
    mockUnsealData.mockClear()

    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_123",
        lastSignInAt: "2026-05-20T05:00:00.000Z",
      },
    }))
    mockCookieGet.mockImplementation(() => ({
      value: "sealed_cookie",
    }))
    mockCookies.mockImplementation(async () => ({
      get: mockCookieGet,
    }))
    mockUnsealData.mockImplementation(async () => ({
      authenticationMethod: "GoogleOAuth",
    }))
    process.env.WORKOS_COOKIE_PASSWORD = "test-password-at-least-32-characters"
  })

  it("returns normalized oauth method and last sign-in timestamp", async () => {
    const route = await import("@/app/api/auth/session/route")
    const response = await route.GET()
    const body = (await response.json()) as {
      ok: boolean
      user: { id: string; lastSignInAt: string | null }
      authenticationMethod: string | null
      authenticationCategory: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.authenticationMethod).toBe("GoogleOAuth")
    expect(body.authenticationCategory).toBe("oauth")
    expect(body.user.lastSignInAt).toBe("2026-05-20T05:00:00.000Z")
  })

  it("returns unknown category when method cannot be decoded", async () => {
    mockCookieGet.mockImplementation(() => ({
      value: "",
    }))

    const route = await import("@/app/api/auth/session/route")
    const response = await route.GET()
    const body = (await response.json()) as {
      ok: boolean
      authenticationMethod: string | null
      authenticationCategory: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.authenticationMethod).toBeNull()
    expect(body.authenticationCategory).toBe("unknown")
  })

  it("returns 401 when auth user is missing", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: null,
    }))

    const route = await import("@/app/api/auth/session/route")
    const response = await route.GET()
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })
})
