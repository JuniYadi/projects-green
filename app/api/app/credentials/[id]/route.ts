import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import {
  updateCredential,
  deleteCredential,
  getCredentialType,
} from "@/modules/credentials/app-credential.service"
import { getCredentialTypeDef } from "@/modules/credentials/credential-type-registry"

export const runtime = "nodejs"

function requireOrg(auth: Awaited<ReturnType<typeof withAuth>>) {
  if (!auth.user)
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    )
  if (!auth.organizationId)
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN", message: "No organization selected" },
      { status: 403 }
    )
  return auth.organizationId
}

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await withAuth({ ensureSignedIn: true })
  const orgId = requireOrg(auth)
  if (orgId instanceof NextResponse) return orgId

  const { id } = await params
  const existingType = await getCredentialType(orgId, id)
  if (!existingType) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }

  const def = getCredentialTypeDef(existingType)
  const body = await req.json()
  const patch: { name?: string; metadata?: unknown; secrets?: unknown } = {}

  if (body.name !== undefined) patch.name = body.name

  if (body.metadata !== undefined) {
    const result = def.metadataSchema.safeParse(body.metadata)
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION", issues: result.error.issues },
        { status: 400 }
      )
    }
    patch.metadata = result.data
  }

  if (body.secrets !== undefined) {
    const result = def.secretsSchema.safeParse(body.secrets)
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION", issues: result.error.issues },
        { status: 400 }
      )
    }
    patch.secrets = result.data
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", message: "No fields to update" },
      { status: 400 }
    )
  }

  const updated = await updateCredential(orgId, id, patch)
  return NextResponse.json({ ok: true, credential: updated })
}

export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await withAuth({ ensureSignedIn: true })
  const orgId = requireOrg(auth)
  if (orgId instanceof NextResponse) return orgId

  const { id } = await params
  await deleteCredential(orgId, id)
  return NextResponse.json({ ok: true })
}
