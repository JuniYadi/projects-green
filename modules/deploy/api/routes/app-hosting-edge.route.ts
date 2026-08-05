import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  hasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"
import {
  addAllowlistEntry,
  createDomainForStack,
  deleteAllowlistEntry,
  deleteDomainForStack,
  getAllowlist,
  listDomainsForStack,
  updateAllowlist,
  uploadDomainCertificate,
  verifyDomain,
} from "@/modules/deploy/app-hosting-edge.service"

type RouteSet = { status?: number | string }

async function requireActor(set: RouteSet, requireManager = false) {
  const auth = await withAuth()
  if (!auth.user) {
    set.status = 401
    return null
  }
  if (!auth.organizationId) {
    set.status = 403
    return null
  }

  if (requireManager) {
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
        set.status = 403
        return null
      }
    }
  }

  return { user: auth.user, organizationId: auth.organizationId }
}

function authError(set: RouteSet) {
  if (set.status === 401) {
    return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
  }
  return { ok: false, error: "FORBIDDEN", message: "Forbidden" }
}

function serviceError(error: unknown, set: RouteSet) {
  const message =
    error instanceof Error ? error.message : "Domain operation failed"
  const normalized = message.toUpperCase()
  const explicitCode =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code).toUpperCase()
      : ""
  let status = 422
  let code = "INVALID_DOMAIN_REQUEST"

  if (explicitCode === "NOT_FOUND" || normalized.includes("NOT_FOUND")) {
    status = 404
    code = "NOT_FOUND"
  } else if (
    explicitCode === "CONFLICT" ||
    normalized.includes("CONFLICT") ||
    normalized.includes("ALREADY_EXISTS") ||
    normalized.includes("DUPLICATE") ||
    normalized.includes("PRIMARY_DOMAIN")
  ) {
    status = 409
    code = "CONFLICT"
  } else if (
    explicitCode === "FORBIDDEN" ||
    normalized.includes("FORBIDDEN") ||
    normalized.includes("ORGANIZATION")
  ) {
    status = 403
    code = "FORBIDDEN"
  } else if (
    explicitCode === "UNAUTHORIZED" ||
    normalized.includes("UNAUTHORIZED")
  ) {
    status = 401
    code = "UNAUTHORIZED"
  }

  set.status = status
  return { ok: false, error: code, message }
}

const stackParams = t.Object({ slug: t.String({ minLength: 1 }) })
const domainParams = t.Object({
  slug: t.String({ minLength: 1 }),
  domainId: t.String({ minLength: 1 }),
})
const allowlistEntryParams = t.Object({
  slug: t.String({ minLength: 1 }),
  domainId: t.String({ minLength: 1 }),
  entryId: t.String({ minLength: 1 }),
})

export const appHostingEdgeRoutes = new Elysia({
  prefix: "/deploy/apps",
})
  .get(
    "/:slug/domains",
    async ({ params, set }) => {
      const actor = await requireActor(set)
      if (!actor) return authError(set)

      try {
        const domains = await listDomainsForStack({
          organizationId: actor.organizationId,
          slug: params.slug,
        })
        return { ok: true, data: domains }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { params: stackParams }
  )
  .post(
    "/:slug/domains",
    async ({ params, body, set }) => {
      const actor = await requireActor(set, true)
      if (!actor) return authError(set)

      try {
        const domain = await createDomainForStack({
          organizationId: actor.organizationId,
          slug: params.slug,
          hostname: body.hostname,
          kind: body.kind,
          isPrimary: body.isPrimary,
        })
        return { ok: true, data: domain }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    {
      params: stackParams,
      body: t.Object({
        hostname: t.Optional(t.String({ minLength: 1 })),
        kind: t.Union([t.Literal("MANAGED"), t.Literal("CUSTOM")]),
        isPrimary: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete(
    "/:slug/domains/:domainId",
    async ({ params, set }) => {
      const actor = await requireActor(set, true)
      if (!actor) return authError(set)

      try {
        const domain = await deleteDomainForStack({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
        })
        return { ok: true, data: domain }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { params: domainParams }
  )
  .post(
    "/:slug/domains/:domainId/verify",
    async ({ params, set }) => {
      const actor = await requireActor(set)
      if (!actor) return authError(set)

      try {
        const domain = await verifyDomain({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
        })
        return { ok: true, data: domain }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { params: domainParams }
  )
  .put(
    "/:slug/domains/:domainId/certificate",
    async ({ params, body, set }) => {
      const actor = await requireActor(set, true)
      if (!actor) return authError(set)

      try {
        const domain = await uploadDomainCertificate({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
          certificate: body.certificate,
          privateKey: body.privateKey,
          chain: body.chain,
        })
        return { ok: true, data: domain }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    {
      params: domainParams,
      body: t.Object({
        certificate: t.String({ minLength: 1 }),
        privateKey: t.String({ minLength: 1 }),
        chain: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:slug/domains/:domainId/allowlist",
    async ({ params, set }) => {
      const actor = await requireActor(set)
      if (!actor) return authError(set)

      try {
        const allowlist = await getAllowlist({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
        })
        return { ok: true, data: allowlist }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { params: domainParams }
  )
  .put(
    "/:slug/domains/:domainId/allowlist",
    async ({ params, body, set }) => {
      const actor = await requireActor(set, true)
      if (!actor) return authError(set)

      try {
        const allowlist = await updateAllowlist({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
          mode: body.mode,
        })
        return { ok: true, data: allowlist }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    {
      params: domainParams,
      body: t.Object({
        mode: t.Union([t.Literal("OPEN"), t.Literal("ALLOWLIST_ONLY")]),
      }),
    }
  )
  .post(
    "/:slug/domains/:domainId/allowlist/entries",
    async ({ params, body, set }) => {
      const actor = await requireActor(set, true)
      if (!actor) return authError(set)

      try {
        const entry = await addAllowlistEntry({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
          cidr: body.cidr,
          description: body.description,
          enabled: body.enabled,
          position: body.position,
        })
        return { ok: true, data: entry }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    {
      params: domainParams,
      body: t.Object({
        cidr: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
        position: t.Optional(t.Number()),
      }),
    }
  )
  .delete(
    "/:slug/domains/:domainId/allowlist/entries/:entryId",
    async ({ params, set }) => {
      const actor = await requireActor(set, true)
      if (!actor) return authError(set)

      try {
        const entry = await deleteAllowlistEntry({
          organizationId: actor.organizationId,
          slug: params.slug,
          domainId: params.domainId,
          entryId: params.entryId,
        })
        return { ok: true, data: entry }
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { params: allowlistEntryParams }
  )
