import { handleAuth } from "@workos-inc/authkit-nextjs"
import { OauthException } from "@workos-inc/node"
import { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  INVITE_COOKIE_NAME,
  buildClearInviteCookieHeader,
} from "@/modules/auth/invite-cookie"

const readInviteTokenFromRequest = (request: NextRequest) => {
  const value = request.cookies.get(INVITE_COOKIE_NAME)?.value?.trim()
  return value || undefined
}

const acceptInviteFromToken = async (invitationToken: string) => {
  try {
    const { findTenantInvitationByToken, acceptTenantInvitation } =
      await import("@/modules/tenants/services/tenant-workos.service")

    const invitation = await findTenantInvitationByToken(invitationToken)
    if (!invitation || invitation.state !== "pending") {
      return
    }

    await acceptTenantInvitation(invitation.id)
  } catch (error) {
    console.error(
      "[auth] /callback invitation accept —",
      error instanceof Error ? (error.stack ?? error.message) : error
    )
  }
}

const authHandler = handleAuth({
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
      const verifyUrl = new URL("/auth/verify-email", request.url)
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
      const selectOrgUrl = new URL("/auth/select-organization", request.url)
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

    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", errorMessage)
    return NextResponse.redirect(loginUrl)
  },
})

export async function GET(request: NextRequest) {
  const inviteToken = readInviteTokenFromRequest(request)
  const response = await authHandler(request)

  if (inviteToken) {
    await acceptInviteFromToken(inviteToken)
    response.headers.append(
      "Set-Cookie",
      buildClearInviteCookieHeader(request.url)
    )
  }

  return response
}
