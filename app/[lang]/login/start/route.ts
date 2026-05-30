import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const providerMap = {
  apple: "AppleOAuth",
  github: "GitHubOAuth",
  google: "GoogleOAuth",
} as const

type ProviderKey = keyof typeof providerMap

const getSafeNext = (next: string | null) => {
  if (!next || !next.startsWith("/")) {
    return "/"
  }

  return next
}

const getOauthProvider = (provider: string | null) => {
  if (!provider) {
    return null
  }

  const normalized = provider.toLowerCase() as ProviderKey
  return providerMap[normalized] ?? null
}

export const GET = async (request: NextRequest) => {
  const next = getSafeNext(request.nextUrl.searchParams.get("next"))
  const redirectUri =
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI?.trim() ||
    process.env.WORKOS_REDIRECT_URI?.trim() ||
    undefined

  // getSignInUrl calls setPKCECookie internally via cookies() from next/headers.
  // Route Handlers return a fresh NextResponse that does NOT inherit those
  // queued cookies automatically — we must copy them onto the response manually.
  const signInUrl = await getSignInUrl({ returnTo: next, redirectUri })
  const oauthProvider = getOauthProvider(
    request.nextUrl.searchParams.get("provider")
  )

  const targetUrl = oauthProvider
    ? (() => {
        const url = new URL(signInUrl)
        url.searchParams.set("provider", oauthProvider)
        url.searchParams.delete("screen_hint")
        return url.toString()
      })()
    : signInUrl

  const response = NextResponse.redirect(targetUrl)

  // Forward PKCE verifier cookies set by getSignInUrl onto the redirect response
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("wos-auth-verifier")) {
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: redirectUri?.startsWith("https") ?? false,
        maxAge: 600, // 10 minutes — matches PKCE_COOKIE_MAX_AGE
      })
    }
  }

  return response
}
