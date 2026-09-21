import { Elysia } from "elysia"
import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"

import {
  createEnvironmentVariable,
  importEnvironmentVariables,
  listEnvironmentVariables,
  updateEnvironmentVariable,
} from "@/modules/deploy/api/environment-variables.stub"
import { requireTenantActor } from "@/modules/tenants/api/tenants.guards"
import {
  toPolicyError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import { isTenantApiError } from "@/modules/tenants/contracts/tenant-api.contract"
import { canManageTenant } from "@/modules/tenants/tenant-policy"
import { prisma } from "@/lib/prisma"
import {
  VaultSecretsService,
  VaultStackNotFoundError,
} from "@/modules/secrets/vault-secrets.service"
import { syncStackConfiguration } from "@/modules/deploy/sync-stack.service"

type StackDb = Pick<PrismaClient, "applicationStack">

type EnvironmentVariablesRouteDeps = {
  requireActor: (
    set: RouteSet
  ) => Promise<Awaited<ReturnType<typeof requireTenantActor>>>
  db?: StackDb
  vaultService?: VaultSecretsService
  sync?: typeof syncStackConfiguration
}

const defaultDependencies: EnvironmentVariablesRouteDeps = {
  requireActor: requireTenantActor,
}

const createRouteGuard =
  (dependencies: EnvironmentVariablesRouteDeps) => async (set: RouteSet) => {
    const actorResult = await dependencies.requireActor(set)

    if (isTenantApiError(actorResult)) {
      return actorResult
    }

    if (!canManageTenant(actorResult)) {
      return toPolicyError(
        set,
        "DEPLOY_ENVIRONMENT_VARIABLES_FORBIDDEN",
        "You are not allowed to manage deploy environment variables."
      )
    }

    return null
  }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const toStoredItems = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord)
}

const createSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z
    .enum(["plain", "secret", "secret_ref", "secret_shared_ref"])
    .optional(),
  scope: z.enum(["all", "build", "runtime"]).optional(),
  serviceCredentialId: z.string().optional(),
  vaultPath: z.string().optional(),
  vaultKey: z.string().optional(),
  referenceLabel: z.string().optional(),
})

const updateSchema = z.object({
  key: z.string(),
  value: z.string().optional(),
  type: z
    .enum(["plain", "secret", "secret_ref", "secret_shared_ref"])
    .optional(),
  scope: z.enum(["all", "build", "runtime"]).optional(),
  serviceCredentialId: z.string().optional(),
  vaultPath: z.string().optional(),
  vaultKey: z.string().optional(),
  referenceLabel: z.string().optional(),
})

const importSchema = z.object({
  raw: z.string(),
  scope: z.enum(["all", "build", "runtime"]).optional(),
})

export const createEnvironmentVariablesRoutes = (
  input: EnvironmentVariablesRouteDeps = defaultDependencies
) => {
  const guard = createRouteGuard(input)
  const db = input.db ?? prisma
  const vault = input.vaultService ?? new VaultSecretsService({ db })
  const doSync = input.sync ?? syncStackConfiguration

  return new Elysia({ prefix: "/deploy/environments/:environmentId/variables" })
    .get("/", async ({ params, set }) => {
      const denied = await guard(set)
      if (denied) {
        return denied
      }

      return {
        ok: true as const,
        items: listEnvironmentVariables(params.environmentId),
      }
    })
    .post(
      "/",
      async ({ params, body, set }) => {
        const denied = await guard(set)
        if (denied) {
          return denied
        }

        return createEnvironmentVariable({
          environmentId: params.environmentId,
          key: body.key,
          value: body.value,
          type: body.type,
          scope: body.scope,
          serviceCredentialId: body.serviceCredentialId,
          vaultPath: body.vaultPath,
          vaultKey: body.vaultKey,
          referenceLabel: body.referenceLabel,
        })
      },
      {
        body: createSchema,
      }
    )
    .patch(
      "/:variableId",
      async ({ params, body, set }) => {
        const denied = await guard(set)
        if (denied) {
          return denied
        }

        return updateEnvironmentVariable({
          environmentId: params.environmentId,
          variableId: params.variableId,
          key: body.key,
          value: body.value,
          type: body.type,
          scope: body.scope,
          serviceCredentialId: body.serviceCredentialId,
          vaultPath: body.vaultPath,
          vaultKey: body.vaultKey,
          referenceLabel: body.referenceLabel,
        })
      },
      {
        body: updateSchema,
      }
    )
    .delete("/:variableId", async ({ params, set }) => {
      const actorResult = await input.requireActor(set)

      if (isTenantApiError(actorResult)) {
        return actorResult
      }

      if (!canManageTenant(actorResult)) {
        return toPolicyError(
          set,
          "DEPLOY_ENVIRONMENT_VARIABLES_FORBIDDEN",
          "You are not allowed to manage deploy environment variables."
        )
      }

      const organizationId = actorResult.organizationId
      if (!organizationId) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: "Organization context required.",
        }
      }

      const stackId = params.environmentId

      // Look up stack from DB, scoped to org
      const stack = await db.applicationStack.findFirst({
        where: { id: stackId, organizationId },
        select: {
          id: true,
          slug: true,
          organizationId: true,
          envVarsJson: true,
        },
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Application stack not found.",
        }
      }

      const items = toStoredItems(stack.envVarsJson)
      const entry = items.find((item) => item.id === params.variableId)

      if (!entry) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Environment variable not found.",
        }
      }

      // Delete from Vault if this is a secret type with a vault path
      const isVaultSecret =
        (entry.type === "secret" || entry.type === "secret_ref") &&
        typeof entry.vaultPath === "string" &&
        entry.vaultPath.length > 0 &&
        typeof entry.vaultKey === "string" &&
        entry.vaultKey.length > 0

      if (isVaultSecret) {
        try {
          await vault.deleteSecret({
            stackId: stack.id,
            vaultPath: entry.vaultPath as string,
            vaultKey: entry.vaultKey as string,
            variableId: params.variableId,
            currentEnvVarsJson: stack.envVarsJson,
          })
        } catch (err) {
          // deleteSecret() threw before reaching its DB update — still clean up DB
          const nextItems = items.filter(
            (item) => item.id !== params.variableId
          )
          await db.applicationStack.update({
            where: { id: stack.id },
            data: { envVarsJson: nextItems as Prisma.InputJsonValue },
          })

          if (!(err instanceof VaultStackNotFoundError)) {
            console.error("[env-vars] Vault deleteSecret error:", err)
            set.status = 500
            return {
              ok: false as const,
              error: "VAULT_DELETE_FAILED" as const,
              message:
                "Failed to remove secret from Vault. Please try again.",
            }
          }
        }
      } else {
        // Plain var: remove from DB directly
        const nextItems = items.filter(
          (item) => item.id !== params.variableId
        )
        await db.applicationStack.update({
          where: { id: stack.id },
          data: { envVarsJson: nextItems as Prisma.InputJsonValue },
        })
      }

      // Non-blocking sync to K8s/GitOps
      doSync({ slug: stack.slug, organizationId }).catch((syncErr) => {
        console.warn(
          `[env-vars] Background syncStackConfiguration for ${stack.slug} failed:`,
          syncErr
        )
      })

      return { ok: true as const, deletedId: params.variableId }
    })
    .post(
      "/import",
      async ({ params, body, set }) => {
        const denied = await guard(set)
        if (denied) {
          return denied
        }

        return importEnvironmentVariables({
          environmentId: params.environmentId,
          raw: body.raw,
          scope: body.scope,
        })
      },
      {
        body: importSchema,
      }
    )
}

export const environmentVariablesRoutes = createEnvironmentVariablesRoutes()
