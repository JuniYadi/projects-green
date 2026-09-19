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
import {
  canManageTenant,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"
import { getPlatformRoleForUser } from "@/lib/platform-role"

type RequireOrgOptions = {
  requireManage?: boolean
}

type RequireOrgResult =
  | { orgId: string }
  | {
      error: "UNAUTHORIZED" | "FORBIDDEN"
      status: 401 | 403
      message?: string
    }

type AuthSession = {
  user: { id: string; email?: string | null } | null
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
}

const requireOrg = async (
  auth: AuthSession,
  options?: RequireOrgOptions
): Promise<RequireOrgResult> => {
  if (!auth.user) return { error: "UNAUTHORIZED", status: 401 }
  if (!auth.organizationId) return { error: "FORBIDDEN", status: 403 }

  if (options?.requireManage) {
    const platformRole = await getPlatformRoleForUser({
      id: auth.user.id,
      email: auth.user.email,
    })
    const tenantRole = resolveTenantRoleFromClaims(auth.role, auth.roles)
    if (!canManageTenant({ platformRole, tenantRole })) {
      return {
        error: "FORBIDDEN",
        status: 403,
        message: "You are not allowed to manage credentials.",
      }
    }
  }

  return { orgId: auth.organizationId }
}

export const credentialsRoutes = new Elysia({ prefix: "/app/credentials" })
  .get("/", async ({ set }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = await requireOrg(auth)
    if ("error" in check) {
      set.status = check.status
      return { ok: false, error: check.error }
    }

    try {
      const credentials = await listCredentials(check.orgId)
      return { ok: true, credentials }
    } catch (error) {
      console.error("[Credentials] Error listing credentials:", error)
      set.status = 500
      return {
        ok: false,
        error: "Unable to load credentials. Please try again.",
      }
    }
  })
  .post("/", async ({ body, set }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = await requireOrg(auth, { requireManage: true })
    if ("error" in check) {
      set.status = check.status
      return { ok: false, error: check.error, message: check.message }
    }
    const {
      type,
      name,
      metadata = {},
      secrets = {},
    } = body as Record<string, unknown>

    if (!type || !name) {
      set.status = 400
      return {
        ok: false,
        error: "VALIDATION",
        message: "type and name are required",
      }
    }

    try {
      getCredentialTypeDef(type as AppCredentialType)
    } catch {
      set.status = 400
      return {
        ok: false,
        error: "VALIDATION",
        message: `Unknown credential type: ${type}`,
      }
    }

    const def = getCredentialTypeDef(type as AppCredentialType)
    const metaResult = def.metadataSchema.safeParse(metadata)
    if (!metaResult.success) {
      set.status = 400
      return { ok: false, error: "VALIDATION", issues: metaResult.error.issues }
    }
    const secretsResult = def.secretsSchema.safeParse(secrets)
    if (!secretsResult.success) {
      set.status = 400
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
    set.status = 201
    return { ok: true, credential }
  })
  .delete("/:id", async ({ params, set }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = await requireOrg(auth, { requireManage: true })
    if ("error" in check) {
      set.status = check.status
      return { ok: false, error: check.error, message: check.message }
    }

    const result = await deleteCredential(check.orgId, params.id)
    if (result.count === 0) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Credential not found" }
    }
    return { ok: true }
  })
  .post("/:id/revoke", async ({ params, set }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    const check = await requireOrg(auth, { requireManage: true })
    if ("error" in check) {
      set.status = check.status
      return { ok: false, error: check.error, message: check.message }
    }

    const result = await revokeCredential(check.orgId, params.id)
    if (result.count === 0) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Credential not found" }
    }
    return { ok: true }
  })
