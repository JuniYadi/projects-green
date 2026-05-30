import { handleAuth } from "@workos-inc/authkit-nextjs"
import { OauthException } from "@workos-inc/node"
import { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// Suppress verbose WorkOS internal logs with cleaner messages
const suppressWorkosLogs = () => {
  const originalError = console.error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    const firstArg = args[0]
    if (
      typeof firstArg === "string" &&
      firstArg.includes("[AuthKit callback error]")
    ) {
      const error = args[1]
      if (error instanceof Error) {
        // Log simplified message
        originalError.call(console, "[Auth]", error.message)
        return
      }
    }
    originalError.apply(console, args)
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

    // Extract user-friendly error message from WorkOS OauthException
    let errorMessage = "Authentication failed"
    if (error instanceof Error) {
      // Check for OAuth errors from WorkOS
      if (error instanceof OauthException) {
        // OAuth errors have meaningful descriptions from WorkOS
        errorMessage =
          error.errorDescription ||
          error.error ||
          "Authentication failed. Please try again."
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
  suppressWorkosLogs()
  return authHandler(request)
}
