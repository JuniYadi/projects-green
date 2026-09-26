import { Elysia } from "elysia"
import { streamText } from "ai"
import { z } from "zod"
import { logStageFailure } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { getAiBotTimeoutMs } from "@/modules/ai/ai-bot-timeout"
import { checkInboundAgentGuardrails } from "@/modules/ai/agents/ai-agent-inbound-guard"
import { inspectAgentPromptSafety } from "@/modules/ai/agents/ai-agent-guardrails"
import { recordSessionStrike } from "@/modules/docs/docs.guard"
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

      // 3b. A visitor already escalated in an earlier request (AC-09) is
      // blocked before the lock or the model — mirrors AC-07's pre-stream
      // JSON envelope. No AiChatBan row is involved; this is a pure
      // session-level block.
      if (session.isBlocked) {
        set.status = 403
        return {
          ok: false,
          error: "CUSTOMER_BLOCKED",
          message: agent.fallbackMessage || null,
        }
      }

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

      // 4b. Widget safety parity (AC-07): the same char-limit / blocked-word
      // / daily-limit checks WhatsApp enforces, via the shared
      // modules/ai/agents/ai-agent-inbound-guard helper. The widget has no
      // channel binding, so only agent.dailyUserLimit applies. A blocked
      // message returns JSON before the stream is built and releases the
      // lock it just acquired.
      const guardResult = checkInboundAgentGuardrails({
        text: message,
        maxCharLength: agent.maxCharLength,
        enableProfanityFilter: agent.enableProfanityFilter,
        customBlockedWords: agent.customBlockedWords,
        fallbackMessage: agent.fallbackMessage,
        dailyUserLimit: agent.dailyUserLimit,
        currentMessageCount: session.totalMessages,
      })
      if (!guardResult.ok) {
        await releaseSessionLock(session.sessionId, lockToken)
        set.status = guardResult.reason === "DAILY_LIMIT_REACHED" ? 429 : 422
        return {
          ok: false,
          error: guardResult.reason,
          ...(guardResult.replyMessage
            ? { message: guardResult.replyMessage }
            : {}),
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

      // 6b. Agent prompt-safety check (injection/profanity/oversize) via the
      // dedicated ai-agent-guardrails safety check (AC-09) — separate from
      // AC-07's char-limit/blocked-word helper above. A violation skips the
      // model call entirely and streams the refusal as a normal chunk, never
      // a raw {error} event. Escalation is session-only: it flips
      // session.isBlocked (checked at the top of the next request) and never
      // creates an AiChatBan row, so no other visitor or WhatsApp customer of
      // the org is ever affected.
      const safetyCheck = inspectAgentPromptSafety(message, {
        maxChars: agent.maxCharLength,
        customBlockedWords: agent.customBlockedWords,
      })
      if (!safetyCheck.ok) {
        const refusalText =
          safetyCheck.refusalMessage ||
          "Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."

        await recordMessage({
          sessionId: session.sessionId,
          role: "assistant",
          content: refusalText,
        })

        if (agent.strikeEscalation) {
          await recordSessionStrike(
            session.sessionId,
            safetyCheck.reason ?? "PROFANITY"
          )
        }

        await releaseSessionLock(session.sessionId, lockToken)

        const encoder = new TextEncoder()
        const refusalStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ chunk: refusalText })}\n\n`
              )
            )
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
          },
        })

        return new Response(refusalStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        })
      }

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
              timeout: getAiBotTimeoutMs(),
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
            // Never surface a raw {error} event to the visitor — stream the
            // agent's fallback as a normal chunk instead (AC-03), whether
            // this was a timeout (AC-02) or any other model/stream failure.
            const fallbackText =
              agent.fallbackMessage ||
              "Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."

            logStageFailure({
              agentProfileId: agent.id,
              sessionId: session.sessionId,
              channel: "WEB_LIVECHAT",
              stage: "GENERATION",
              error: err,
            })

            try {
              await recordMessage({
                sessionId: session.sessionId,
                role: "assistant",
                content: fallbackText,
              })
            } catch {
              // best-effort — the fallback chunk below still reaches the
              // visitor even if persisting it fails
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ chunk: fallbackText })}\n\n`
              )
            )
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
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
