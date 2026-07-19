import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { revokeCredential } from "@/modules/credentials/app-credential.service"

export const runtime = "nodejs"

function requireOrg(auth: Awaited<ReturnType<typeof withAuth>>) {
  if (!auth.user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
  if (!auth.organizationId) return NextResponse.json({ ok: false, error: "FORBIDDEN", message: "No organization selected" }, { status: 403 })
  return auth.organizationId
}

export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await withAuth({ ensureSignedIn: true })
  const orgId = requireOrg(auth)
  if (orgId instanceof NextResponse) return orgId

  const { id } = await params
  await revokeCredential(orgId, id)
  return NextResponse.json({ ok: true })
}
