import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import type { AppCredentialType } from "@prisma/client"

import {
  createCredential,
  deleteCredential,
  listCredentials,
  revokeCredential,
} from "@/modules/credentials/app-credential.service"
import { getCredentialTypeDef } from "@/modules/credentials/credential-type-registry"

const requireOrg = (auth: Awaited<ReturnType<typeof withAuth>>) => {
  if (!auth.user) return { error: "UNAUTHORIZED", status: 401 as const }
  if (!auth.organizationId) return { error: "FORBIDDEN", status: 403 as const }
  return { orgId: auth.organizationId }
}

export const credentialsRoutes = new Elysia({ prefix: "/app/credentials" })
  .get("/", async () => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = requireOrg(auth)
    if ("error" in check) return { ok: false, error: check.error }

    const credentials = await listCredentials(check.orgId)
    return { ok: true, credentials }
  })
  .post("/", async ({ body }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = requireOrg(auth)
    if ("error" in check) return { ok: false, error: check.error }

    const {
      type,
      name,
      metadata = {},
      secrets = {},
    } = body as Record<string, unknown>

    if (!type || !name) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "type and name are required",
      }
    }

    try {
      getCredentialTypeDef(type as AppCredentialType)
    } catch {
      return {
        ok: false,
        error: "VALIDATION",
        message: `Unknown credential type: ${type}`,
      }
    }

    const def = getCredentialTypeDef(type as AppCredentialType)
    const metaResult = def.metadataSchema.safeParse(metadata)
    if (!metaResult.success) {
      return { ok: false, error: "VALIDATION", issues: metaResult.error.issues }
    }

    const secretsResult = def.secretsSchema.safeParse(secrets)
    if (!secretsResult.success) {
      return {
        ok: false,
        error: "VALIDATION",
        issues: secretsResult.error.issues,
      }
    }

    const credential = await createCredential({
      organizationId: check.orgId,
      type: type as AppCredentialType,
      name: name as string,
      metadata: metaResult.data,
      secrets: secretsResult.data,
    })

    return { ok: true, credential }
  })
  .delete("/:id", async ({ params }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = requireOrg(auth)
    if ("error" in check) return { ok: false, error: check.error }

    await deleteCredential(check.orgId, params.id)
    return { ok: true }
  })
  .post("/:id/revoke", async ({ params }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = requireOrg(auth)
    if ("error" in check) return { ok: false, error: check.error }

    await revokeCredential(check.orgId, params.id)
    return { ok: true }
  })
