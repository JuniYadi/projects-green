import type { NextRequest, NextResponse } from "next/server"

import { isSecureRequest } from "@/lib/request-url"

// Short-lived httpOnly cookie that carries a WorkOS invitation token from the
// branded /invite accept screen through whichever auth method the invitee uses
// (magic code, password, or OAuth). It is cleared once the token is consumed.
export const INVITE_COOKIE_NAME = "pg-invite-token"
export const INVITE_COOKIE_MAX_AGE = 60 * 30 // 30 minutes

const isHttps = (
  request?: NextRequest | Request | { headers?: Headers; url?: string } | string
) => isSecureRequest(request)

export const buildInviteCookieHeader = (
  token: string,
  request?: NextRequest | Request | { headers?: Headers; url?: string } | string
) => {
  const parts = [
    `${INVITE_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${INVITE_COOKIE_MAX_AGE}`,
  ]

  if (isHttps(request)) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

export const buildClearInviteCookieHeader = (
  request?: NextRequest | Request | { headers?: Headers; url?: string } | string
) => {
  const parts = [
    `${INVITE_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ]

  if (isHttps(request)) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

export const setInviteCookie = (
  response: NextResponse,
  token: string,
  request?: NextRequest | Request | { headers?: Headers; url?: string } | string
) => {
  response.cookies.set(INVITE_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isHttps(request),
    maxAge: INVITE_COOKIE_MAX_AGE,
  })
}

export const clearInviteCookie = (
  response: NextResponse,
  request?: NextRequest | Request | { headers?: Headers; url?: string } | string
) => {
  response.cookies.set(INVITE_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isHttps(request),
    maxAge: 0,
  })
}
