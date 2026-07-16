import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import {
  createGithubService,
  GithubIntegrationDisabledError,
  GithubReconnectRequiredError,
} from "@/modules/github/github.service"
import type {
  GithubActorContext,
  GithubInstallationRecord,
  GithubRepositoryListResult,
} from "@/modules/github/github.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const githubService = createGithubService()

const parseLimit = (value: string | null) => {
  if (!value) {
    return DEFAULT_LIMIT
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.min(parsed, MAX_LIMIT)
}

export const GET = async (request: NextRequest) => {
  try {
    githubService.assertEnabled()
  } catch (error) {
    if (error instanceof GithubIntegrationDisabledError) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "FEATURE_DISABLED" as const,
          message: "GitHub App integration is disabled.",
        },
        { status: 404 }
      )
    }

    throw error
  }

  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.user) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "UNAUTHORIZED" as const,
        message: "You must be signed in to list GitHub repositories.",
      },
      { status: 401 }
    )
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

  if (!limit) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "INVALID_QUERY" as const,
        message: "Invalid pagination query parameters.",
      },
      { status: 400 }
    )
  }
  const ownerIdRaw = request.nextUrl.searchParams.get("ownerId")
  const ownerId = ownerIdRaw?.trim() || null
  const queryRaw = request.nextUrl.searchParams.get("query")
  const query = queryRaw?.trim() || null
  const actor: GithubActorContext = {
    userId: auth.user.id,
    organizationId: auth.organizationId ?? null,
  }
  let result: GithubRepositoryListResult
  let installations: GithubInstallationRecord[] = []

  try {
    installations = await githubService.listInstallationsForActor(actor)

    result = await githubService.listRepositoriesForActor(actor, {
      limit,
      cursor: request.nextUrl.searchParams.get("cursor") || undefined,
      ownerId: ownerId || undefined,
      query: query || undefined,
    })
  } catch (error) {
    if (error instanceof GithubReconnectRequiredError) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "GITHUB_RECONNECT_REQUIRED" as const,
          message:
            "GitHub access expired or was revoked. Reconnect GitHub to continue.",
        },
        { status: 409 }
      )
    }

    throw error
  }

  return NextResponse.json({
    ok: true as const,
    items: result.items.map((item) => ({
      id: item.repositoryId.toString(),
      repositoryId: item.repositoryId.toString(),
      fullName: item.fullName,
      name: item.name,
      owner: item.owner,
      installationId: item.installationId.toString(),
      defaultBranch: item.defaultBranch,
      private: item.private,
      syncedAt: item.pushedAt,
    })),
    owners: installations.map((inst) => ({
      id: inst.accountLogin,
      name: inst.accountLogin,
      avatarUrl: null as string | null,
    })),
    nextCursor: result.nextCursor,
  })
}
