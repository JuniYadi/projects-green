import { handleAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const authHandler = handleAuth({
  onError: async ({ error, request }) => {
    const authError = error as {
      code?: string
      pendingAuthenticationToken?: string
      rawData?: { email?: string }
    }
    const pendingAuthenticationToken =
      authError.pendingAuthenticationToken?.trim() || ""

    if (
      authError.code === "email_verification_required" &&
      pendingAuthenticationToken
    ) {
      const verifyUrl = new URL("/auth/verify-email", request.url)
      verifyUrl.searchParams.set(
        "pendingAuthenticationToken",
        pendingAuthenticationToken
      )

      if (authError.rawData?.email) {
        verifyUrl.searchParams.set("email", authError.rawData.email)
      }

      return NextResponse.redirect(verifyUrl)
    }

    // Redirect to login with error message instead of JSON response
    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed"
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", errorMessage)
    return NextResponse.redirect(loginUrl)
  },
})

export async function GET(request: NextRequest) {
  return authHandler(request)
}
