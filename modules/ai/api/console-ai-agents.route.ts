import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { requireConsoleOrgAuth } from "./console-ai-providers.route"

export function createConsoleAiAgentsRoutes() {
  return new Elysia({ prefix: "/console/ai/agents" })
    .get("/", async ({ set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const agents = await prisma.aiAgentProfile.findMany({
        where: { organizationId: auth.orgId },
        orderBy: { createdAt: "desc" },
        include: {
          channelBindings: {
            select: {
              id: true,
              channel: true,
              targetId: true,
              targetName: true,
              isActive: true,
            },
          },
          knowledgeDocuments: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      })

      return {
        ok: true,
        data: agents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          systemPrompt: a.systemPrompt,
          fallbackMessage: a.fallbackMessage,
          dailyUserLimit: a.dailyUserLimit,
          maxCharLength: a.maxCharLength,
          enableProfanityFilter: a.enableProfanityFilter,
          customBlockedWords: a.customBlockedWords,
          isActive: a.isActive,
          channelsCount: a.channelBindings.length,
          channelBindings: a.channelBindings,
          knowledgeDocs: a.knowledgeDocuments,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
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
          description,
          systemPrompt = "Anda adalah asisten AI toko resmi.",
          fallbackMessage = "Maaf, pertanyaan Anda akan kami teruskan ke tim CS kami.",
          dailyUserLimit = 20,
          enableProfanityFilter = true,
        } = body

        if (!name?.trim()) {
          set.status = 400
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "name is required",
          }
        }

        const agent = await prisma.aiAgentProfile.create({
          data: {
            organizationId: auth.orgId,
            name: name.trim(),
            description: description?.trim() || null,
            systemPrompt: systemPrompt.trim(),
            fallbackMessage: fallbackMessage.trim(),
            dailyUserLimit,
            enableProfanityFilter,
            isActive: true,
          },
        })

        return {
          ok: true,
          data: agent,
        }
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          systemPrompt: t.Optional(t.String()),
          fallbackMessage: t.Optional(t.String()),
          dailyUserLimit: t.Optional(t.Number()),
          enableProfanityFilter: t.Optional(t.Boolean()),
        }),
      }
    )
    .put(
      "/:id",
      async ({ params, body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const existing = await prisma.aiAgentProfile.findFirst({
          where: { id: params.id, organizationId: auth.orgId },
        })

        if (!existing) {
          set.status = 404
          return { ok: false, error: "NOT_FOUND", message: "Agent not found" }
        }

        const updated = await prisma.aiAgentProfile.update({
          where: { id: existing.id },
          data: {
            ...(body.name ? { name: body.name.trim() } : {}),
            ...(body.description !== undefined
              ? { description: body.description?.trim() || null }
              : {}),
            ...(body.systemPrompt !== undefined
              ? { systemPrompt: body.systemPrompt.trim() }
              : {}),
            ...(body.fallbackMessage
              ? { fallbackMessage: body.fallbackMessage.trim() }
              : {}),
            ...(body.dailyUserLimit !== undefined
              ? { dailyUserLimit: body.dailyUserLimit }
              : {}),
            ...(body.enableProfanityFilter !== undefined
              ? { enableProfanityFilter: body.enableProfanityFilter }
              : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          },
        })

        return {
          ok: true,
          data: updated,
        }
      },
      {
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          systemPrompt: t.Optional(t.String()),
          fallbackMessage: t.Optional(t.String()),
          dailyUserLimit: t.Optional(t.Number()),
          enableProfanityFilter: t.Optional(t.Boolean()),
          isActive: t.Optional(t.Boolean()),
        }),
      }
    )
    .post(
      "/:id/bindings",
      async ({ params, body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const agent = await prisma.aiAgentProfile.findFirst({
          where: { id: params.id, organizationId: auth.orgId },
        })

        if (!agent) {
          set.status = 404
          return { ok: false, error: "NOT_FOUND", message: "Agent not found" }
        }

        const { channel, targetId, targetName } = body

        if (!channel || !targetId) {
          set.status = 400
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "channel and targetId are required",
          }
        }

        const binding = await prisma.aiChannelBinding.upsert({
          where: {
            channel_targetId: {
              channel,
              targetId,
            },
          },
          update: {
            agentProfileId: agent.id,
            organizationId: auth.orgId,
            targetName: targetName?.trim() || null,
            isActive: true,
          },
          create: {
            organizationId: auth.orgId,
            agentProfileId: agent.id,
            channel,
            targetId,
            targetName: targetName?.trim() || null,
            isActive: true,
          },
        })

        return {
          ok: true,
          data: binding,
        }
      },
      {
        body: t.Object({
          channel: t.String(),
          targetId: t.String(),
          targetName: t.Optional(t.String()),
        }),
      }
    )
    .delete("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const existing = await prisma.aiAgentProfile.findFirst({
        where: { id: params.id, organizationId: auth.orgId },
      })

      if (!existing) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Agent not found" }
      }

      await prisma.aiAgentProfile.delete({
        where: { id: existing.id },
      })

      return {
        ok: true,
        message: "Agent deleted successfully",
      }
    })
}
