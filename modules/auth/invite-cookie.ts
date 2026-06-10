import type { NextResponse } from "next/server"

// Short-lived httpOnly cookie that carries a WorkOS invitation token from the
// branded /invite accept screen through whichever auth method the invitee uses
// (magic code, password, or OAuth). It is cleared once the token is consumed.
export const INVITE_COOKIE_NAME = "pg-invite-token"
export const INVITE_COOKIE_MAX_AGE = 60 * 30 // 30 minutes

const isHttps = (requestUrl?: string) => {
  if (!requestUrl) {
    return false
  }

  try {
    return new URL(requestUrl).protocol === "https:"
  } catch {
    return false
  }
}

export const buildInviteCookieHeader = (
  token: string,
  requestUrl?: string
) => {
  const parts = [
    `${INVITE_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${INVITE_COOKIE_MAX_AGE}`,
  ]

  if (isHttps(requestUrl)) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

export const buildClearInviteCookieHeader = (requestUrl?: string) => {
  const parts = [
    `${INVITE_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ]

  if (isHttps(requestUrl)) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

export const setInviteCookie = (
  response: NextResponse,
  token: string,
  requestUrl?: string
) => {
  response.cookies.set(INVITE_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isHttps(requestUrl),
    maxAge: INVITE_COOKIE_MAX_AGE,
  })
}

export const clearInviteCookie = (
  response: NextResponse,
  requestUrl?: string
) => {
  response.cookies.set(INVITE_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isHttps(requestUrl),
    maxAge: 0,
  })
}
