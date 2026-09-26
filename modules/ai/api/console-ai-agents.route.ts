import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { requireConsoleOrgAuth } from "./console-ai-providers.route"
import {
  toAiAgentDetailDTO,
  toAiAgentListItemDTO,
} from "@/modules/ai/agents/ai-agent.dto"

const listInclude = {
  channelBindings: {
    select: {
      id: true,
      channel: true,
      targetId: true,
      targetName: true,
      isActive: true,
    },
  },
} as const

export function createConsoleAiAgentsRoutes() {
  return new Elysia({ prefix: "/console/ai/agents" })
    .get("/", async ({ query, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const agents = await prisma.aiAgentProfile.findMany({
        where: {
          organizationId: auth.orgId,
          ...(query.includeArchived === "true"
            ? {}
            : { status: { not: "ARCHIVED" as const } }),
        },
        orderBy: { createdAt: "desc" },
        include: listInclude,
      })

      return {
        ok: true,
        data: agents.map(toAiAgentListItemDTO),
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
          allowInteractiveReplies = true,
          allowedDomains = [],
          widgetColor = "#10B981",
          widgetPosition = "bottom-right",
          welcomeMessage = "Halo! Ada yang bisa kami bantu?",
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
            allowInteractiveReplies,
            allowedDomains,
            widgetColor,
            widgetPosition,
            welcomeMessage,
            status: "DRAFT",
            isActive: false,
          },
          include: listInclude,
        })

        return {
          ok: true,
          data: toAiAgentListItemDTO(agent),
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
          allowInteractiveReplies: t.Optional(t.Boolean()),
          allowedDomains: t.Optional(t.Array(t.String())),
          widgetColor: t.Optional(t.String({ pattern: "^#[0-9a-fA-F]{3,8}$" })),
          widgetPosition: t.Optional(
            t.Union([t.Literal("bottom-right"), t.Literal("bottom-left")])
          ),
          welcomeMessage: t.Optional(t.String()),
        }),
      }
    )
    .get("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const agent = await prisma.aiAgentProfile.findFirst({
        where: { id: params.id, organizationId: auth.orgId },
        include: listInclude,
      })
      if (!agent) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Agent not found" }
      }

      return { ok: true, data: toAiAgentDetailDTO(agent) }
    })
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
            ...(body.allowInteractiveReplies !== undefined
              ? {
                  allowInteractiveReplies: body.allowInteractiveReplies,
                }
              : {}),
            ...(body.allowedDomains !== undefined
              ? { allowedDomains: body.allowedDomains }
              : {}),
            ...(body.widgetColor !== undefined
              ? { widgetColor: body.widgetColor }
              : {}),
            ...(body.widgetPosition !== undefined
              ? { widgetPosition: body.widgetPosition }
              : {}),
            ...(body.welcomeMessage !== undefined
              ? { welcomeMessage: body.welcomeMessage }
              : {}),
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
          allowInteractiveReplies: t.Optional(t.Boolean()),
          allowedDomains: t.Optional(t.Array(t.String())),
          widgetColor: t.Optional(t.String({ pattern: "^#[0-9a-fA-F]{3,8}$" })),
          widgetPosition: t.Optional(
            t.Union([t.Literal("bottom-right"), t.Literal("bottom-left")])
          ),
          welcomeMessage: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/:id/status",
      async ({ params, body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const existing = await prisma.aiAgentProfile.findFirst({
          where: { id: params.id, organizationId: auth.orgId },
          include: listInclude,
        })
        if (!existing) {
          set.status = 404
          return { ok: false, error: "NOT_FOUND", message: "Agent not found" }
        }

        if (
          body.status === "ACTIVE" &&
          !existing.channelBindings.some((binding) => binding.isActive)
        ) {
          set.status = 409
          return {
            ok: false,
            error: "AGENT_REQUIRES_ACTIVE_BINDING",
            message: "Connect an active channel before activating the agent",
          }
        }

        const status =
          existing.status === "ARCHIVED" && body.status !== "ARCHIVED"
            ? "DRAFT"
            : body.status
        const updated = await prisma.aiAgentProfile.update({
          where: { id: existing.id },
          data: {
            status,
            isActive: status === "ACTIVE",
            archivedAt: status === "ARCHIVED" ? new Date() : null,
          },
          include: listInclude,
        })

        return { ok: true, data: toAiAgentListItemDTO(updated) }
      },
      {
        body: t.Object({
          status: t.Union([
            t.Literal("ACTIVE"),
            t.Literal("PAUSED"),
            t.Literal("ARCHIVED"),
            t.Literal("DRAFT"),
          ]),
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

        const normalizedChannel = channel.trim().toUpperCase()

        const binding = await prisma.aiChannelBinding.upsert({
          where: {
            channel_targetId: {
              channel: normalizedChannel,
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
            channel: normalizedChannel,
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
    .delete("/:id/bindings/:bindingId", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const existing = await prisma.aiChannelBinding.findFirst({
        where: {
          id: params.bindingId,
          agentProfileId: params.id,
          organizationId: auth.orgId,
        },
      })

      if (!existing) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Binding not found" }
      }

      await prisma.aiChannelBinding.delete({
        where: { id: existing.id },
      })

      return { ok: true }
    })
    .delete(
      "/:id",
      async ({ params, query, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const existing = await prisma.aiAgentProfile.findFirst({
          where: { id: params.id, organizationId: auth.orgId },
          include: {
            channelBindings: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        })

        if (!existing) {
          set.status = 404
          return { ok: false, error: "NOT_FOUND", message: "Agent not found" }
        }

        if (existing.channelBindings.length > 0 && query.force !== "true") {
          set.status = 409
          return {
            ok: false,
            error: "AGENT_HAS_ACTIVE_BINDINGS",
            message: "Disconnect active channels before deleting the agent",
            activeBindings: existing.channelBindings.length,
          }
        }

        await prisma.aiAgentProfile.delete({
          where: { id: existing.id },
        })

        return {
          ok: true,
          message: "Agent deleted successfully",
        }
      },
      {
        query: t.Object({
          force: t.Optional(t.String()),
        }),
      }
    )
}
