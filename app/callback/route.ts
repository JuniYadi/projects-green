import { handleAuth } from "@workos-inc/authkit-nextjs"
import { OauthException } from "@workos-inc/node"
import { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { getRequestUrl } from "@/lib/request-url"
import {
  INVITE_COOKIE_NAME,
  buildClearInviteCookieHeader,
} from "@/modules/auth/invite-cookie"
import * as tenantWorkosService from "@/modules/tenants/services/tenant-workos.service"

export const readInviteTokenFromRequest = (request: NextRequest | Request) => {
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    const value = request.cookies.get(INVITE_COOKIE_NAME)?.value?.trim()
    if (value) return value
  }
  const rawCookie = request.headers.get("cookie") ?? ""
  for (const part of rawCookie.split(";")) {
    const [name, ...val] = part.trim().split("=")
    if (name === INVITE_COOKIE_NAME) {
      const decoded = decodeURIComponent(val.join("=")).trim()
      if (decoded) return decoded
    }
  }
  return undefined
}

export const acceptInviteFromToken = async (
  invitationToken: string,
  deps = tenantWorkosService
) => {
  try {
    const invitation = await deps.findTenantInvitationByToken(invitationToken)
    if (!invitation || invitation.state !== "pending") {
      return null
    }

    await deps.acceptTenantInvitation(invitation.id)
    return invitation.organizationId
  } catch (error) {
    console.error(
      "[auth] /callback invitation accept —",
      error instanceof Error ? (error.stack ?? error.message) : error
    )
    return null
  }
}
const authHandler = handleAuth({
  baseURL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || undefined,
  onError: async ({ error, request }) => {
    const hasErrorObject =
      error && typeof error === "object" && !Array.isArray(error)
    const code =
      hasErrorObject && "code" in error ? (error.code as string) : undefined
    const pendingAuthenticationToken =
      hasErrorObject && "pendingAuthenticationToken" in error
        ? (error.pendingAuthenticationToken as string | undefined)?.trim() || ""
        : ""
    if (code === "email_verification_required" && pendingAuthenticationToken) {
      const verifyUrl = getRequestUrl("/auth/verify-email", request)
      verifyUrl.searchParams.set(
        "pendingAuthenticationToken",
        pendingAuthenticationToken
      )

      const rawData =
        hasErrorObject && "rawData" in error && error.rawData
          ? (error.rawData as { email?: string })
          : undefined
      if (rawData?.email) {
        verifyUrl.searchParams.set("email", rawData.email)
      }

      return NextResponse.redirect(verifyUrl)
    }

    if (
      code === "organization_selection_required" &&
      pendingAuthenticationToken
    ) {
      const selectOrgUrl = getRequestUrl("/auth/select-organization", request)
      selectOrgUrl.searchParams.set(
        "pendingAuthenticationToken",
        pendingAuthenticationToken
      )

      // Forward rawData so the org selection page can render the org list
      // without an extra WorkOS API call. Contains: { user, organizations }
      const rawData =
        hasErrorObject && "rawData" in error && error.rawData
          ? (error.rawData as {
              user?: Record<string, unknown>
              organizations?: Array<{ id: string; name: string }>
            })
          : undefined

      if (rawData?.organizations) {
        selectOrgUrl.searchParams.set(
          "organizations",
          JSON.stringify(rawData.organizations)
        )
      }

      if (rawData?.user?.email) {
        selectOrgUrl.searchParams.set(
          "email",
          (rawData.user.email as string) ?? ""
        )
      }

      return NextResponse.redirect(selectOrgUrl)
    }

    // Extract user-friendly error message from WorkOS OauthException
    let errorMessage = "Authentication failed"
    if (error instanceof Error) {
      // Check for OAuth errors from WorkOS
      if (error instanceof OauthException) {
        // Map OAuth error codes to user-friendly messages
        const errorCode = error.error?.toLowerCase() ?? ""
        const errorDesc = error.errorDescription

        if (errorCode === "access_denied" || errorDesc?.includes("cancelled")) {
          errorMessage = "Sign in was cancelled. Please try again."
        } else if (
          errorCode === "invalid_request" ||
          errorCode === "server_error"
        ) {
          errorMessage = "Sign in failed. Please try again."
        } else if (errorDesc) {
          // Use description if available, but only if it's user-friendly
          errorMessage =
            errorDesc.length < 100
              ? errorDesc
              : "Sign in failed. Please try again."
        } else {
          errorMessage = "Authentication failed. Please try again."
        }
      } else if (
        error.message.includes("Auth cookie missing") ||
        error.message.includes("OAuth state")
      ) {
        // Cookie/state errors - session expired
        errorMessage = "Session expired. Please sign in again."
      } else {
        // Generic error
        errorMessage = "Sign in failed. Please try again."
      }
    }

    const loginUrl = getRequestUrl("/login", request)
    loginUrl.searchParams.set("error", errorMessage)
    return NextResponse.redirect(loginUrl)
  },
})

export const handleGetCallback = async (
  request: NextRequest,
  deps?: {
    acceptInvite?: typeof acceptInviteFromToken
    handleAuthRoute?: (req: NextRequest) => Promise<Response>
  }
) => {
  const acceptInvite = deps?.acceptInvite ?? acceptInviteFromToken
  const handleAuthRoute = deps?.handleAuthRoute ?? authHandler
  const inviteToken = readInviteTokenFromRequest(request)
  if (inviteToken) {
    await acceptInvite(inviteToken)
  }
  const response = await handleAuthRoute(request)

  if (inviteToken) {
    const clearCookieHeader = buildClearInviteCookieHeader(request)
    response.headers.append("set-cookie", clearCookieHeader)
  }

  return response
}

export async function GET(request: NextRequest) {
  return handleGetCallback(request)
}
