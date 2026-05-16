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

    if (process.env.NODE_ENV === "production") {
      return Response.json(
        {
          error: {
            message: "Something went wrong",
            description:
              "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
          },
        },
        { status: 400 }
      )
    }

    const details =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown callback error"

    return Response.json(
      {
        error: {
          message: "Auth callback failed",
          description:
            "Check redirect URI, cookie state, and WorkOS provider configuration.",
          details,
        },
      },
      { status: 400 }
    )
  },
})

export async function GET(request: NextRequest) {
  return authHandler(request)
}
