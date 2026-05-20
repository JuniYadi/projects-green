import { withAuth } from "@workos-inc/authkit-nextjs"
import { unsealData } from "iron-session"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AuthSessionCookie = {
  authenticationMethod?: string | null
}

const resolveAuthMethodCategory = (
  authenticationMethod: string | null | undefined
) => {
  if (!authenticationMethod) {
    return "unknown" as const
  }

  if (authenticationMethod === "SSO") {
    return "sso" as const
  }

  if (authenticationMethod.endsWith("OAuth")) {
    return "oauth" as const
  }

  if (authenticationMethod === "Password") {
    return "password" as const
  }

  if (authenticationMethod === "MagicAuth") {
    return "magic_link" as const
  }

  if (authenticationMethod === "Passkey") {
    return "passkey" as const
  }

  if (authenticationMethod === "Impersonation") {
    return "impersonation" as const
  }

  return "unknown" as const
}

const resolveAuthenticationMethod = async () => {
  const cookieName = process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD?.trim()

  if (!cookiePassword) {
    return null
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(cookieName)

  if (!sessionCookie?.value) {
    return null
  }

  try {
    const payload = await unsealData<AuthSessionCookie>(sessionCookie.value, {
      password: cookiePassword,
    })

    return payload?.authenticationMethod?.trim() || null
  } catch {
    return null
  }
}

export const GET = async () => {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.user) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "UNAUTHORIZED" as const,
        message: "You must be signed in.",
      },
      { status: 401 }
    )
  }

  const authenticationMethod = await resolveAuthenticationMethod()

  return NextResponse.json({
    ok: true as const,
    authenticationMethod,
    authenticationCategory: resolveAuthMethodCategory(authenticationMethod),
    lastSignInAt: auth.user.lastSignInAt ?? null,
  })
}
