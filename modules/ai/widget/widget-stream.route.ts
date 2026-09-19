import { Elysia } from "elysia"
import { streamText } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  acquireSessionLock,
  getOrCreateSession,
  getSlidingWindowMessages,
  recordMessage,
  releaseSessionLock,
} from "@/modules/ai/agents/ai-agent-session.service"
import { buildAgentTools } from "@/modules/ai/agents/ai-agent-tools"
import {
  createAiLanguageModel,
  resolveAiProviderConfig,
} from "@/modules/ai/ai-provider.factory"
import { isAllowedOrigin } from "./widget-domain.guard"

export interface StreamDependencies {
  streamTextFn?: typeof streamText
}

const widgetStreamSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  message: z.string().min(1, "message is required"),
  visitorId: z.string().min(1, "visitorId is required"),
})

export type WidgetStreamBody = z.infer<typeof widgetStreamSchema>

export function createPublicAiWidgetRoutes(deps: StreamDependencies = {}) {
  const runStreamText = deps.streamTextFn || streamText

  return new Elysia({ prefix: "/ai/widget" }).post(
    "/stream",
    async ({ request, set }) => {
      let rawBody: unknown
      try {
        rawBody = await request.json()
      } catch {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Invalid JSON body.",
        }
      }

      const parseResult = widgetStreamSchema.safeParse(rawBody)
      if (!parseResult.success) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Validation error",
        }
      }

      const { agentId, message, visitorId } = parseResult.data
      const origin =
        request.headers.get("origin") ||
        request.headers.get("referer") ||
        request.headers.get("x-origin") ||
        request.headers.get("x-forwarded-host")

      // 1. Retrieve AiAgentProfile
      const agent = await prisma.aiAgentProfile.findUnique({
        where: { id: agentId },
      })

      if (!agent || !agent.isActive) {
        set.status = 404
        return {
          ok: false,
          error: "AGENT_NOT_FOUND",
          message: "Agent profile not found or inactive.",
        }
      }

      // 2. Validate Origin / Referer against agent.allowedDomains
      const allowed = isAllowedOrigin(origin, agent.allowedDomains || [])
      if (!allowed) {
        set.status = 403
        return {
          ok: false,
          error: "ORIGIN_NOT_ALLOWED",
          message: "Origin is not authorized to interact with this agent.",
        }
      }

      // 3. Session tracking
      const sessionId = `widget_${agent.id}_${visitorId}`
      const session = await getOrCreateSession({
        sessionId,
        organizationId: agent.organizationId,
        agentProfileId: agent.id,
        channel: "WEB_LIVECHAT",
        externalUserId: visitorId,
      })

      // 4. Concurrency lock
      const lockToken = await acquireSessionLock(session.sessionId, 15)
      if (!lockToken) {
        set.status = 429
        return {
          ok: false,
          error: "CONCURRENT_REQUEST",
          message:
            "A response is already generating for this session. Please wait.",
        }
      }

      // 5. Sliding window memory + build tools
      const history = await getSlidingWindowMessages(session.id, 10)
      const tools = await buildAgentTools({
        organizationId: agent.organizationId || "",
        agentProfileId: agent.id,
        sessionId: session.sessionId,
      })

      // 6. Record user message
      await recordMessage({
        sessionId: session.sessionId,
        role: "user",
        content: message,
      })

      // 7. Resolve Language Model
      const providerConfig = await resolveAiProviderConfig({
        organizationId: agent.organizationId,
      })
      const model = createAiLanguageModel(providerConfig)

      const systemPrompt = [
        agent.systemPrompt || "Anda adalah asisten AI toko resmi.",
        "Gunakan bahasa yang ramah, sopan, dan jelas.",
      ].join("\n\n")

      const conversationMessages = [
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ]

      // 8. Stream execution with SSE response
      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          let fullAssistantText = ""

          try {
            const aiStream = await runStreamText({
              model,
              system: systemPrompt,
              messages: conversationMessages,
              tools,
            })

            for await (const chunk of aiStream.textStream) {
              fullAssistantText += chunk
              const sseEvent = `data: ${JSON.stringify({ chunk })}\n\n`
              controller.enqueue(encoder.encode(sseEvent))
            }

            // End of stream marker
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))

            // Record assistant message tokens
            await recordMessage({
              sessionId: session.sessionId,
              role: "assistant",
              content: fullAssistantText,
              modelName: providerConfig.defaultModel,
            })
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : "Stream error"
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: errorMessage })}\n\n`
              )
            )
          } finally {
            await releaseSessionLock(session.sessionId, lockToken)
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    }
  )
}
