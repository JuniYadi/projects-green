import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import {
  getSafeReturnTo,
  issueGithubInstallState,
} from "@/modules/github/github-install-state"
import { getGithubInstallUrl } from "@/modules/github/github.service"

export const runtime = "nodejs"

const getStateSecret = () => {
  return (
    process.env.GITHUB_APP_STATE_SECRET?.trim() ||
    process.env.GITHUB_APP_CLIENT_SECRET?.trim() ||
    ""
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

  const returnTo = getSafeReturnTo(request.nextUrl.searchParams.get("returnTo"))
  const stateSecret = getStateSecret()

  const { state } = await issueGithubInstallState({
    workosUserId: auth.user.id,
    organizationId: auth.organizationId ?? null,
    returnTo,
    secret: stateSecret,
  })

  const githubInstallUrl = getGithubInstallUrl({ state })

  return NextResponse.redirect(githubInstallUrl)
}
