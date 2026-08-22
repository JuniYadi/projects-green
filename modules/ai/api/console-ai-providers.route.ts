import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { generateText } from "ai"

import { prisma } from "@/lib/prisma"
import {
  saveProviderApiKey,
  deleteProviderApiKey,
  getProviderApiKey,
} from "@/modules/ai/ai-vault.service"
import {
  createAiLanguageModel,
  type ProviderType,
} from "@/modules/ai/ai-provider.factory"

export type ConsoleAuthCheck =
  | { orgId: string; userId: string }
  | { error: string; status: number }

export async function requireConsoleOrgAuth(): Promise<ConsoleAuthCheck> {
  const auth = await withAuth()
  if (!auth.user) {
    return { error: "UNAUTHORIZED", status: 401 }
  }
  const orgId = auth.organizationId ?? null
  if (!orgId) {
    return { error: "FORBIDDEN", status: 403 }
  }
  return { orgId, userId: auth.user.id }
}

export function createConsoleAiProvidersRoutes() {
  return new Elysia({ prefix: "/console/ai/providers" })
    .get("/", async ({ set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const providers = await prisma.aiProviderConfig.findMany({
        where: { organizationId: auth.orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          providerType: true,
          baseUrl: true,
          defaultModel: true,
          isDefault: true,
          isConfigured: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        ok: true,
        data: providers,
      }
    })
    .post(
      "/",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const {
          name,
          providerType,
          baseUrl,
          defaultModel,
          apiKey,
          isDefault = false,
        } = body

        if (!name || !providerType || !defaultModel) {
          set.status = 400
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "name, providerType, and defaultModel are required",
          }
        }

        if (providerType !== "MANAGED" && !apiKey?.trim()) {
          set.status = 400
          return {
            ok: false,
            error: "API_KEY_REQUIRED",
            message: "apiKey is required for BYOK provider configuration",
          }
        }

        // If setting as default, unset other defaults in org
        if (isDefault) {
          await prisma.aiProviderConfig.updateMany({
            where: { organizationId: auth.orgId, isDefault: true },
            data: { isDefault: false },
          })
        }

        const tempId = `prov_${Date.now()}`
        let vaultPath = ""

        if (apiKey?.trim()) {
          const vaultRes = await saveProviderApiKey({
            organizationId: auth.orgId,
            providerId: tempId,
            apiKey: apiKey.trim(),
          })
          vaultPath = vaultRes.vaultPath
        }

        const provider = await prisma.aiProviderConfig.create({
          data: {
            organizationId: auth.orgId,
            name: name.trim(),
            providerType: providerType as ProviderType,
            baseUrl: baseUrl?.trim() || null,
            defaultModel: defaultModel.trim(),
            vaultPath:
              vaultPath || `tenants/${auth.orgId}/ai/providers/${tempId}`,
            vaultKey: "API_KEY",
            isDefault: Boolean(isDefault),
            isConfigured: true,
          },
          select: {
            id: true,
            name: true,
            providerType: true,
            baseUrl: true,
            defaultModel: true,
            isDefault: true,
            isConfigured: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        return {
          ok: true,
          data: provider,
        }
      },
      {
        body: t.Object({
          name: t.String(),
          providerType: t.Union([
            t.Literal("OPENAI_COMPATIBLE"),
            t.Literal("ANTHROPIC"),
            t.Literal("MANAGED"),
          ]),
          baseUrl: t.Optional(t.String()),
          defaultModel: t.String(),
          apiKey: t.Optional(t.String()),
          isDefault: t.Optional(t.Boolean()),
        }),
      }
    )
    .post(
      "/test",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const { providerId, providerType, baseUrl, defaultModel, apiKey } = body

        let effectiveKey = apiKey?.trim() || ""

        if (!effectiveKey && providerId) {
          const config = await prisma.aiProviderConfig.findFirst({
            where: { id: providerId, organizationId: auth.orgId },
          })
          if (config) {
            effectiveKey =
              (await getProviderApiKey({
                organizationId: auth.orgId,
                providerId: config.id,
              })) || ""
          }
        }

        if (providerType !== "MANAGED" && !effectiveKey) {
          set.status = 400
          return {
            ok: false,
            error: "API_KEY_REQUIRED",
            message: "Cannot test connection without an API key",
          }
        }

        try {
          const model = createAiLanguageModel({
            providerType: providerType as ProviderType,
            baseUrl: baseUrl?.trim() || null,
            defaultModel: defaultModel.trim(),
            apiKey: effectiveKey,
          })

          const start = performance.now()
          const result = await generateText({
            model,
            prompt: "Say hello in 3 words.",
          })
          const durationMs = Math.round(performance.now() - start)

          return {
            ok: true,
            message: "Connection test succeeded",
            reply: result.text.trim(),
            durationMs,
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          set.status = 422
          return {
            ok: false,
            error: "CONNECTION_FAILED",
            message: errorMessage,
          }
        }
      },
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          providerType: t.Union([
            t.Literal("OPENAI_COMPATIBLE"),
            t.Literal("ANTHROPIC"),
            t.Literal("MANAGED"),
          ]),
          baseUrl: t.Optional(t.String()),
          defaultModel: t.String(),
          apiKey: t.Optional(t.String()),
        }),
      }
    )
    .delete("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const existing = await prisma.aiProviderConfig.findFirst({
        where: { id: params.id, organizationId: auth.orgId },
      })

      if (!existing) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Provider not found" }
      }

      await deleteProviderApiKey({
        organizationId: auth.orgId,
        providerId: existing.id,
      })

      await prisma.aiProviderConfig.delete({
        where: { id: existing.id },
      })

      return {
        ok: true,
        message: "Provider deleted successfully",
      }
    })
}
