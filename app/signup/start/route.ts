import { getSignUpUrl } from "@workos-inc/authkit-nextjs"
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

export const GET = async (
  request: NextRequest,
) => {
  const next = getSafeNext(request.nextUrl.searchParams.get("next"))
  const redirectUri =
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI?.trim() ||
    process.env.WORKOS_REDIRECT_URI?.trim() ||
    undefined
  const signUpUrl = await getSignUpUrl({ returnTo: next, redirectUri })
  const oauthProvider = getOauthProvider(
    request.nextUrl.searchParams.get("provider")
  )

  if (!oauthProvider) {
    return NextResponse.redirect(signUpUrl)
  }

  const directProviderUrl = new URL(signUpUrl)
  directProviderUrl.searchParams.set("provider", oauthProvider)
  directProviderUrl.searchParams.delete("screen_hint")

  return NextResponse.redirect(directProviderUrl.toString())
}
