import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export const GET = async () => {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    )
  }

  const installations = await prisma.githubInstallation.findMany({
    where: auth.organizationId
      ? { organizationId: auth.organizationId, status: "active" }
      : { workosUserId: auth.user.id, organizationId: null, status: "active" },
    orderBy: { installedAt: "asc" },
  })

  const accounts = installations.map((i) => ({
    id: i.id,
    accountLogin: i.accountLogin,
    accountType: i.accountType,
    targetType: i.targetType,
    installedAt: i.installedAt.toISOString(),
  }))

  return NextResponse.json({ ok: true, accounts })
}
