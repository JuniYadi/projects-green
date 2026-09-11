import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import type { Prisma } from "@prisma/client"

import {
  encrypt,
  getEncryptionKey,
  serializeEncryptedField,
} from "@/lib/encryption"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { prisma } from "@/lib/prisma"
import { isValidEnvVarKey } from "@/modules/deploy/deploy.schema"
import {
  hasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"

const environments = ["dev", "staging", "prod"] as const
type EnvironmentId = (typeof environments)[number]
type JsonRecord = Record<string, unknown>

type StoredEnvVar = {
  id?: string
  key: string
  value?: unknown
  type?: string
  scope?: string
  masked?: boolean
  isStoredSecret?: boolean
  source?: string
  serviceCredentialId?: string
  vaultPath?: string
  vaultKey?: string
  referenceLabel?: string
  lastUpdatedAt?: string
  updatedAt?: string
  [key: string]: unknown
}

type StoredMount = {
  id: string
  type: "pvc" | "configmap" | "secret" | "emptyDir"
  name: string
  mountPath: string
  subPath?: string
  readOnly: boolean
  sizeGb?: number
  sourceName?: string
  defaultMode?: number
  contentEncrypted?: string
  [key: string]: unknown
}

const envVarSchema = t.Object(
  {
    id: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
    key: t.String({ minLength: 1, maxLength: 256 }),
    value: t.Optional(t.String()),
    type: t.Optional(
      t.Union([
        t.Literal("plain"),
        t.Literal("secret"),
        t.Literal("secret_ref"),
        t.Literal("secret_shared_ref"),
      ])
    ),
    scope: t.Optional(
      t.Union([t.Literal("all"), t.Literal("build"), t.Literal("runtime")])
    ),
    masked: t.Optional(t.Boolean()),
    isStoredSecret: t.Optional(t.Boolean()),
    source: t.Optional(
      t.Union([t.Literal("vault"), t.Literal("managed_service")])
    ),
    serviceCredentialId: t.Optional(t.String()),
    vaultPath: t.Optional(t.String()),
    vaultKey: t.Optional(t.String()),
    referenceLabel: t.Optional(t.String()),
  },
  { additionalProperties: false }
)

const mountSchema = t.Object(
  {
    id: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
    type: t.Union([
      t.Literal("pvc"),
      t.Literal("configmap"),
      t.Literal("secret"),
      t.Literal("emptyDir"),
    ]),
    name: t.String({ minLength: 1, maxLength: 256 }),
    mountPath: t.String({ minLength: 1, maxLength: 1024 }),
    subPath: t.Optional(t.String({ maxLength: 1024 })),
    readOnly: t.Optional(t.Boolean()),
    sizeGb: t.Optional(t.Number({ minimum: 1 })),
    sourceName: t.Optional(t.String({ maxLength: 256 })),
    defaultMode: t.Optional(t.Integer({ minimum: 0, maximum: 511 })),
    content: t.Optional(t.String()),
  },
  { additionalProperties: false }
)

const environmentSchema = t.Union([
  t.Literal("dev"),
  t.Literal("staging"),
  t.Literal("prod"),
])

function isEnvironment(value: unknown): value is EnvironmentId {
  return (
    typeof value === "string" && environments.includes(value as EnvironmentId)
  )
}

function isSecret(variable: StoredEnvVar): boolean {
  return (
    variable.type === "secret" ||
    variable.type === "secret_ref" ||
    variable.type === "secret_shared_ref" ||
    variable.masked === true ||
    variable.isStoredSecret === true
  )
}

function parseArray(value: unknown): unknown[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value : []
}

function safeEnvVar(value: unknown): JsonRecord {
  const variable = (
    value && typeof value === "object" ? value : {}
  ) as StoredEnvVar
  const secret = isSecret(variable)
  const result: JsonRecord = {
    id: variable.id ?? variable.key,
    key: variable.key,
    type: variable.type ?? (secret ? "secret" : "plain"),
    scope: variable.scope ?? "runtime",
    masked: secret,
    isStoredSecret: secret,
  }
  for (const field of [
    "source",
    "serviceCredentialId",
    "vaultPath",
    "vaultKey",
    "referenceLabel",
  ] as const) {
    if (typeof variable[field] === "string") result[field] = variable[field]
  }
  const updatedAt = variable.lastUpdatedAt ?? variable.updatedAt
  if (typeof updatedAt === "string") result.lastUpdatedAt = updatedAt
  if (!secret && typeof variable.value === "string")
    result.value = variable.value
  return result
}

function storageMounts(
  metadata: unknown
): Record<EnvironmentId, StoredMount[]> {
  const root =
    metadata && typeof metadata === "object" ? (metadata as JsonRecord) : {}
  const storage =
    root.storage && typeof root.storage === "object"
      ? (root.storage as JsonRecord)
      : {}
  const mounts =
    storage.mounts && typeof storage.mounts === "object"
      ? (storage.mounts as JsonRecord)
      : {}
  return {
    dev: parseArray(mounts.dev) as StoredMount[],
    staging: parseArray(mounts.staging) as StoredMount[],
    prod: parseArray(mounts.prod) as StoredMount[],
  }
}

function safeMount(mount: StoredMount): JsonRecord {
  const { content, contentEncrypted, ...safe } = mount
  return { ...safe }
}

function settingsData(stack: { envVarsJson: unknown; metadataJson: unknown }) {
  const mounts = storageMounts(stack.metadataJson)
  return {
    envVars: parseArray(stack.envVarsJson).map(safeEnvVar),
    mounts: {
      dev: mounts.dev.map(safeMount),
      staging: mounts.staging.map(safeMount),
      prod: mounts.prod.map(safeMount),
    },
  }
}

async function findStack(organizationId: string, slug: string) {
  return prisma.applicationStack.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
    select: {
      id: true,
      organizationId: true,
      envVarsJson: true,
      metadataJson: true,
    },
  })
}

async function authorize(
  set: { status?: number | string },
  requireManager = false
) {
  const auth = await withAuth()
  if (!auth.user) {
    set.status = 401
    return {
      error: { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" },
    }
  }
  if (!auth.organizationId) {
    set.status = 403
    return {
      error: {
        ok: false,
        error: "FORBIDDEN",
        message: "Organization required",
      },
    }
  }
  if (requireManager) {
    const platformRole = await getPlatformRoleForUser({
      id: auth.user.id,
      email: auth.user.email,
    })
    const isSuperAdmin =
      platformRole === "super_admin" ||
      hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)
    const tenantRole = resolveTenantRoleFromClaims(
      auth.role ?? null,
      auth.roles ?? null
    )
    if (!isSuperAdmin && tenantRole !== "owner" && tenantRole !== "admin") {
      set.status = 403
      return { error: { ok: false, error: "FORBIDDEN", message: "Forbidden" } }
    }
  }
  return { organizationId: auth.organizationId }
}
export const appSettingsRoutes = new Elysia({ prefix: "/deploy/apps" })
  .get("/:slug/settings", async ({ params, set }) => {
    const auth = await authorize(set)
    if ("error" in auth) return auth.error
    const stack = await findStack(auth.organizationId, params.slug)
    if (!stack) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Application not found" }
    }
    return { ok: true, data: settingsData(stack) }
  })
  .patch(
    "/:slug/settings/env",
    async ({ params, body, set }) => {
      const auth = await authorize(set, true)
      if ("error" in auth) return auth.error
      const stack = await findStack(auth.organizationId, params.slug)
      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }
      if (!isEnvironment(body.environmentId)) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid environmentId",
        }
      }
      const invalidKey = body.variables.find(
        (variable) => !isValidEnvVarKey(variable.key)
      )
      if (invalidKey) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: `Invalid environment variable key: ${invalidKey.key}`,
        }
      }
      const existing = parseArray(stack.envVarsJson) as StoredEnvVar[]
      const oldByKey = new Map(existing.map((row) => [row.key, row]))
      const variables = body.variables.map((incoming) => {
        const prior = oldByKey.get(incoming.key)
        const secret =
          incoming.type === "secret" ||
          incoming.type === "secret_ref" ||
          incoming.type === "secret_shared_ref" ||
          incoming.masked === true ||
          incoming.isStoredSecret === true ||
          isSecret(prior ?? { key: incoming.key })
        const row: StoredEnvVar = {
          ...incoming,
          type: incoming.type ?? prior?.type ?? (secret ? "secret" : "plain"),
        }
        if (
          secret &&
          (!incoming.value || incoming.value.length === 0) &&
          prior &&
          "value" in prior
        )
          row.value = prior.value
        if (secret) {
          row.masked = true
          row.isStoredSecret = true
        }
        return row
      })
      const updated = await prisma.applicationStack.update({
        where: { id: stack.id },
        data: { envVarsJson: variables as Prisma.InputJsonValue },
        select: { envVarsJson: true, metadataJson: true },
      })
      return {
        ok: true,
        data: { envVars: parseArray(updated.envVarsJson).map(safeEnvVar) },
      }
    },
    {
      body: t.Object({
        environmentId: environmentSchema,
        variables: t.Array(envVarSchema, { maxItems: 500 }),
      }),
    }
  )
  .patch(
    "/:slug/settings/mounts",
    async ({ params, body, set }) => {
      const auth = await authorize(set, true)
      if ("error" in auth) return auth.error
      const stack = await findStack(auth.organizationId, params.slug)
      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }
      const invalidMount = body.mounts.find(
        (mount) => !mount.mountPath.trim().startsWith("/")
      )
      if (invalidMount) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Mount path must be absolute",
        }
      }
      if (!isEnvironment(body.environmentId)) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid environmentId",
        }
      }
      const mounts = storageMounts(stack.metadataJson)
      const priorById = new Map(
        mounts[body.environmentId].map((mount) => [mount.id, mount])
      )
      const canonical = body.mounts.map((mount) => {
        const id = mount.id ?? crypto.randomUUID()
        const prior = priorById.get(id)
        const row: StoredMount = {
          id,
          type: mount.type,
          name: mount.name.trim(),
          mountPath: mount.mountPath.trim(),
          readOnly: mount.readOnly ?? false,
          ...(mount.subPath ? { subPath: mount.subPath.trim() } : {}),
          ...(mount.sizeGb !== undefined ? { sizeGb: mount.sizeGb } : {}),
          ...(mount.sourceName ? { sourceName: mount.sourceName.trim() } : {}),
          ...(mount.defaultMode !== undefined
            ? { defaultMode: mount.defaultMode }
            : {}),
          ...(prior?.contentEncrypted
            ? { contentEncrypted: prior.contentEncrypted }
            : {}),
          ...(prior?.contentSummary
            ? { contentSummary: prior.contentSummary }
            : {}),
        }
        if (mount.content !== undefined && mount.content.length > 0) {
          row.contentEncrypted = serializeEncryptedField(
            encrypt(mount.content, getEncryptionKey())
          )
          row.contentSummary = `[REDACTED] bytes=${mount.content.length}`
        }
        return row
      })
      const metadata =
        stack.metadataJson && typeof stack.metadataJson === "object"
          ? { ...(stack.metadataJson as JsonRecord) }
          : {}
      const storage =
        metadata.storage && typeof metadata.storage === "object"
          ? { ...(metadata.storage as JsonRecord) }
          : {}
      storage.mounts = { ...mounts, [body.environmentId]: canonical }
      metadata.storage = storage
      const updated = await prisma.applicationStack.update({
        where: { id: stack.id },
        data: { metadataJson: metadata as Prisma.InputJsonValue },
        select: { envVarsJson: true, metadataJson: true },
      })
      const safe = storageMounts(updated.metadataJson)[body.environmentId].map(
        safeMount
      )
      return { ok: true, data: { mounts: safe } }
    },
    {
      body: t.Object({
        environmentId: environmentSchema,
        mounts: t.Array(mountSchema, { maxItems: 200 }),
      }),
    }
  )
  .delete(
    "/:slug/settings/mounts/:mountId",
    async ({ params, query, set }) => {
      const auth = await authorize(set, true)
      if ("error" in auth) return auth.error
      const stack = await findStack(auth.organizationId, params.slug)
      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }
      const environmentId = (query as { environmentId?: string }).environmentId
      if (!isEnvironment(environmentId)) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "environmentId is required",
        }
      }
      const mounts = storageMounts(stack.metadataJson)
      if (!mounts[environmentId].some((mount) => mount.id === params.mountId)) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Mount not found" }
      }
      const metadata =
        stack.metadataJson && typeof stack.metadataJson === "object"
          ? { ...(stack.metadataJson as JsonRecord) }
          : {}
      const storage =
        metadata.storage && typeof metadata.storage === "object"
          ? { ...(metadata.storage as JsonRecord) }
          : {}
      storage.mounts = {
        ...mounts,
        [environmentId]: mounts[environmentId].filter(
          (mount) => mount.id !== params.mountId
        ),
      }
      metadata.storage = storage
      const updated = await prisma.applicationStack.update({
        where: { id: stack.id },
        data: { metadataJson: metadata as Prisma.InputJsonValue },
        select: { metadataJson: true },
      })
      return {
        ok: true,
        data: {
          mounts: storageMounts(updated.metadataJson)[environmentId].map(
            safeMount
          ),
        },
      }
    },
    { query: t.Object({ environmentId: environmentSchema }) }
  )
