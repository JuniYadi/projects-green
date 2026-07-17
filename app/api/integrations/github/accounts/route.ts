import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  hasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"

export const runtime = "nodejs"

export const GET = async () => {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    )
  }

  const platformRole = await getPlatformRoleForUser(auth.user)
  const isSuperAdmin =
    platformRole === "super_admin" ||
    hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

  if (!isSuperAdmin) {
    const tenantRole = resolveTenantRoleFromClaims(
      auth.role ?? null,
      auth.roles ?? null
    )
    if (tenantRole !== "owner" && tenantRole !== "admin") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Insufficient permissions" },
        { status: 403 }
      )
    }
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
