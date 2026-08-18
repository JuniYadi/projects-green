import { Elysia, t } from "elysia"

import {
  VaultAuthError,
  VaultNetworkError,
  VaultSecretNotFoundError,
} from "@/lib/vault/vault-client"
import { VaultConfigError } from "@/lib/vault/vault-config"
import {
  requireTenantActor,
  type TenantActorContext,
} from "@/modules/tenants/api/tenants.guards"
import {
  isTenantApiError,
  toNotFoundError,
  toPolicyError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import { canManageTenant } from "@/modules/tenants/tenant-policy"
import {
  VaultSecretValidationError,
  VaultSecretsService,
  VaultStackNotFoundError,
} from "@/modules/secrets/vault-secrets.service"
import {
  toVaultSecretMetadataDTO,
  toVaultSecretRevealDTO,
  toVaultSecretWriteDTO,
} from "./vault-secrets.dto"

type VaultSecretsRouteDependencies = {
  requireActor: typeof requireTenantActor
  service: VaultSecretsService
}

const defaultDependencies: VaultSecretsRouteDependencies = {
  requireActor: requireTenantActor,
  service: new VaultSecretsService(),
}

const requireSecretsActor = async (
  dependencies: VaultSecretsRouteDependencies,
  set: RouteSet
): Promise<TenantActorContext | ReturnType<typeof toPolicyError>> => {
  const actor = await dependencies.requireActor(set)
  if (isTenantApiError(actor)) {
    return actor
  }

  if (!actor.organizationId || !canManageTenant(actor)) {
    return toPolicyError(
      set,
      "VAULT_SECRETS_FORBIDDEN",
      "You are not allowed to manage application secrets."
    )
  }

  return actor
}

const toVaultRouteError = (set: RouteSet, error: unknown) => {
  if (
    error instanceof VaultStackNotFoundError ||
    error instanceof VaultSecretNotFoundError
  ) {
    return toNotFoundError(set, "Application secret not found")
  }

  if (error instanceof VaultSecretValidationError) {
    set.status = 422
    return {
      ok: false as const,
      error: "VAULT_SECRET_VALIDATION_ERROR",
      message: error.message,
    }
  }

  if (error instanceof VaultConfigError) {
    set.status = 503
    return {
      ok: false as const,
      error: "VAULT_CONFIGURATION_ERROR",
      message: "Vault is not configured for secret operations.",
    }
  }

  if (error instanceof VaultAuthError) {
    set.status = 503
    return {
      ok: false as const,
      error: "VAULT_AUTH_ERROR",
      message: "Vault authentication failed.",
    }
  }

  if (error instanceof VaultNetworkError) {
    set.status = 503
    return {
      ok: false as const,
      error: "VAULT_NETWORK_ERROR",
      message: "Vault is temporarily unavailable.",
    }
  }

  throw error
}

export const createVaultSecretsRoutes = (
  input: Partial<VaultSecretsRouteDependencies> = {}
) => {
  const dependencies: VaultSecretsRouteDependencies = {
    ...defaultDependencies,
    ...input,
  }

  return new Elysia({ prefix: "/stacks/:id/secrets" })
    .post(
      "/",
      async ({ params, body, set }) => {
        const actor = await requireSecretsActor(dependencies, set)
        if (isTenantApiError(actor)) {
          return actor
        }

        try {
          const result = await dependencies.service.writeSecrets({
            organizationId: actor.organizationId as string,
            stackId: params.id,
            environment: body.environment,
            secrets: body.secrets,
          })

          return { ok: true as const, data: toVaultSecretWriteDTO(result) }
        } catch (error) {
          return toVaultRouteError(set, error)
        }
      },
      {
        body: t.Object({
          environment: t.String({ minLength: 1, maxLength: 64 }),
          secrets: t.Record(t.String({ minLength: 1 }), t.String()),
        }),
      }
    )
    .get(
      "/metadata",
      async ({ params, query, set }) => {
        const actor = await requireSecretsActor(dependencies, set)
        if (isTenantApiError(actor)) {
          return actor
        }

        try {
          const result = await dependencies.service.getSecretMetadata({
            organizationId: actor.organizationId as string,
            stackId: params.id,
            environment: query.environment,
          })

          return {
            ok: true as const,
            data: toVaultSecretMetadataDTO(result),
          }
        } catch (error) {
          return toVaultRouteError(set, error)
        }
      },
      {
        query: t.Object({
          environment: t.String({ minLength: 1, maxLength: 64 }),
        }),
      }
    )
    .post(
      "/reveal",
      async ({ params, body, set }) => {
        const actor = await requireSecretsActor(dependencies, set)
        if (isTenantApiError(actor)) {
          return actor
        }

        try {
          const result = await dependencies.service.revealSecret({
            organizationId: actor.organizationId as string,
            stackId: params.id,
            environment: body.environment,
            key: body.key,
            workosUserId: actor.userId,
          })

          return {
            ok: true as const,
            data: toVaultSecretRevealDTO(result),
          }
        } catch (error) {
          return toVaultRouteError(set, error)
        }
      },
      {
        body: t.Object({
          environment: t.String({ minLength: 1, maxLength: 64 }),
          key: t.String({ minLength: 1, maxLength: 255 }),
        }),
      }
    )
}

export const vaultSecretsRoutes = createVaultSecretsRoutes()
