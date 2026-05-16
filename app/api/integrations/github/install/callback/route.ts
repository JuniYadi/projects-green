import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import {
  getSafeReturnTo,
  GithubInstallStateError,
  validateGithubInstallState,
} from "@/modules/github/github-install-state"
import {
  fetchGithubInstallationDetails,
  fetchGithubInstallationRepositories,
  syncGithubInstallation,
} from "@/modules/github/github.service"

export const runtime = "nodejs"

const getStateSecret = () => {
  return (
    process.env.GITHUB_APP_STATE_SECRET?.trim() ||
    process.env.GITHUB_APP_CLIENT_SECRET?.trim() ||
    ""
  )
}

const toRedirectUrl = ({
  returnTo,
  requestUrl,
  status,
}: {
  returnTo: string
  requestUrl: string
  status: "connected" | "error"
}) => {
  const redirectUrl = new URL(returnTo, requestUrl)
  redirectUrl.searchParams.set("github", status)

  return redirectUrl
}

const toErrorRedirect = ({
  returnTo,
  requestUrl,
}: {
  returnTo: string
  requestUrl: string
}) => {
  return NextResponse.redirect(
    toRedirectUrl({
      returnTo,
      requestUrl,
      status: "error",
    })
  )
}

export const GET = async (request: NextRequest) => {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.user) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "UNAUTHORIZED" as const,
        message: "You must be signed in to connect GitHub.",
      },
      { status: 401 }
    )
  }

  let errorReturnTo = "/console"

  try {
    const installationIdRaw =
      request.nextUrl.searchParams.get("installation_id")?.trim() ?? ""

    if (!installationIdRaw) {
      throw new Error("Missing installation_id parameter")
    }

    const installationId = BigInt(installationIdRaw)
    const state = request.nextUrl.searchParams.get("state")
    const statePayload = await validateGithubInstallState({
      state,
      secret: getStateSecret(),
    })
    errorReturnTo = getSafeReturnTo(statePayload.returnTo)

    if (statePayload.workosUserId !== auth.user.id) {
      throw new GithubInstallStateError(
        "STATE_USER_MISMATCH",
        "GitHub install state does not match this user session."
      )
    }

    const activeOrgId = auth.organizationId ?? null

    if (statePayload.organizationId !== activeOrgId) {
      throw new GithubInstallStateError(
        "STATE_ORGANIZATION_MISMATCH",
        "GitHub install state does not match this organization session."
      )
    }

    const installation = await fetchGithubInstallationDetails(installationId)
    const repositories =
      await fetchGithubInstallationRepositories(installationId)

    await syncGithubInstallation({
      installationId,
      workosUserId: statePayload.workosUserId,
      organizationId: statePayload.organizationId,
      installation,
      repositories,
    })

    return NextResponse.redirect(
      toRedirectUrl({
        returnTo: getSafeReturnTo(statePayload.returnTo),
        requestUrl: request.url,
        status: "connected",
      })
    )
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("GitHub install callback failed", error)
    }

    if (error instanceof GithubInstallStateError) {
      return toErrorRedirect({
        returnTo: errorReturnTo,
        requestUrl: request.url,
      })
    }

    return toErrorRedirect({
      returnTo: errorReturnTo,
      requestUrl: request.url,
    })
  }
}
