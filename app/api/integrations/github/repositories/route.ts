import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  createGithubService,
  GithubIntegrationDisabledError,
} from "@/modules/github/github.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const githubService = createGithubService()

type RepositoryRow = {
  id: string
  githubRepositoryId: bigint
  fullName: string
  repoName: string
  ownerLogin: string
  defaultBranch: string | null
  isPrivate: boolean
  installation: {
    githubInstallationId: bigint
  }
  lastSyncedAt: Date | null
}

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

  return BigInt(value)
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

  const records = (await prisma.githubRepositoryConnection.findMany({
    where: {
      ...(cursor ? { githubRepositoryId: { gt: cursor } } : {}),
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { repoName: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      installation: {
        status: "active",
        workosUserId: auth.user.id,
        organizationId: auth.organizationId ?? null,
        ...(ownerId ? { accountLogin: ownerId } : {}),
      },
    },
    select: {
      id: true,
      githubRepositoryId: true,
      fullName: true,
      repoName: true,
      ownerLogin: true,
      defaultBranch: true,
      isPrivate: true,
      lastSyncedAt: true,
      installation: {
        select: {
          githubInstallationId: true,
        },
      },
    },
    orderBy: {
      githubRepositoryId: "asc",
    },
    take: limit + 1,
  })) as RepositoryRow[]

  const hasNextPage = records.length > limit
  const pageItems = hasNextPage ? records.slice(0, limit) : records

  return NextResponse.json({
    ok: true as const,
    items: pageItems.map((record) => ({
      id: record.id,
      repositoryId: record.githubRepositoryId.toString(),
      fullName: record.fullName,
      name: record.repoName,
      owner: record.ownerLogin,
      installationId: record.installation.githubInstallationId.toString(),
      defaultBranch: record.defaultBranch,
      private: record.isPrivate,
      syncedAt: record.lastSyncedAt?.toISOString() ?? null,
    })),
    nextCursor: hasNextPage
      ? pageItems[pageItems.length - 1]?.githubRepositoryId.toString() ?? null
      : null,
  })
}
