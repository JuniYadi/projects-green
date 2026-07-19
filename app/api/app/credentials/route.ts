import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"
import type { AppCredentialType } from "@prisma/client"

import {
  createCredential,
  listCredentials,
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

export const GET = async () => {
  const auth = await withAuth({ ensureSignedIn: true })
  const orgId = requireOrg(auth)
  if (orgId instanceof NextResponse) return orgId

  const credentials = await listCredentials(orgId)
  return NextResponse.json({ ok: true, credentials })
}

export const POST = async (req: Request) => {
  const auth = await withAuth({ ensureSignedIn: true })
  const orgId = requireOrg(auth)
  if (orgId instanceof NextResponse) return orgId

  const body = await req.json()
  const { type, name, metadata = {}, secrets = {} } = body

  if (!type || !name) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", message: "type and name are required" },
      { status: 400 }
    )
  }

  try {
    getCredentialTypeDef(type as AppCredentialType)
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "VALIDATION",
        message: `Unknown credential type: ${type}`,
      },
      { status: 400 }
    )
  }

  const def = getCredentialTypeDef(type as AppCredentialType)

  const metaResult = def.metadataSchema.safeParse(metadata)
  if (!metaResult.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", issues: metaResult.error.issues },
      { status: 400 }
    )
  }

  const secretsResult = def.secretsSchema.safeParse(secrets)
  if (!secretsResult.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", issues: secretsResult.error.issues },
      { status: 400 }
    )
  }

  const credential = await createCredential({
    organizationId: orgId,
    type: type as AppCredentialType,
    name,
    metadata: metaResult.data,
    secrets: secretsResult.data,
  })

  return NextResponse.json({ ok: true, credential }, { status: 201 })
}
