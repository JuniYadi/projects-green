import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import {
  createGithubService,
  GithubIntegrationDisabledError,
} from "@/modules/github/github.service"

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

const parseCursor = (value: string | null) => {
  if (!value) {
    return null
  }

  if (!/^-?[0-9]+$/.test(value)) {
    return null
  }

  const bigIntValue = BigInt(value)

  // Validate that the value is within signed 64-bit integer range
  const MIN_INT64 = BigInt("-9223372036854775808")
  const MAX_INT64 = BigInt("9223372036854775807")

  if (bigIntValue < MIN_INT64 || bigIntValue > MAX_INT64) {
    return null
  }

  return bigIntValue
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
  const cursor = parseCursor(request.nextUrl.searchParams.get("cursor"))

  if (
    !limit ||
    (request.nextUrl.searchParams.get("cursor") !== null && cursor === null)
  ) {
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

  const result = await githubService.listRepositoriesForActor(
    {
      userId: auth.user.id,
      organizationId: auth.organizationId ?? null,
    },
    {
      limit,
      cursor: request.nextUrl.searchParams.get("cursor") || undefined,
      ownerId: ownerId || undefined,
      query: query || undefined,
    }
  )

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
    nextCursor: result.nextCursor,
  })
}
