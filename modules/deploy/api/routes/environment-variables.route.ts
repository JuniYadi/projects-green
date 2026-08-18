import { Elysia } from "elysia"
import { z } from "zod"

import {
  createEnvironmentVariable,
  deleteEnvironmentVariable,
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

type EnvironmentVariablesRouteDeps = {
  requireActor: (
    set: RouteSet
  ) => Promise<Awaited<ReturnType<typeof requireTenantActor>>>
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
      const denied = await guard(set)
      if (denied) {
        return denied
      }

      return deleteEnvironmentVariable({
        environmentId: params.environmentId,
        variableId: params.variableId,
      })
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
