import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText } from "ai"
import { z } from "zod"
import { randomUUID } from "crypto"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  normalizeDocPath,
  searchKnowledgeDocs as searchKnowledgeDocsService,
} from "@/modules/docs/docs.service"
import {
  inspectPromptSafety,
  checkRateLimit,
  checkActiveBan,
  recordStrikeAndEscalate,
} from "@/modules/docs/docs.guard"
import type {
  KnowledgeChatRequest,
  KnowledgeCitation,
} from "@/modules/docs/docs.types"

const knowledgeChatBodySchema = z.object({
  sessionId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1),
      })
    )
    .min(1),
  routePath: z.string().min(1),
})

const STREAM_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const

const STRICT_KB_FALLBACK_MESSAGE =
  "I don't know from the current knowledgebase."
const MIN_CONTEXT_SCORE = 6

export type KnowledgeAuthContext = {
  organizationId?: string | null
  user: {
    email?: string | null
    id: string
  } | null
}

type RouteSet = {
  status?: number | string
}

type KnowledgeRouteDependencies = {
  authenticate: () => Promise<KnowledgeAuthContext>
  searchKnowledgeDocs: typeof searchKnowledgeDocsService
  streamKnowledgeAnswer: (input: {
    messages: KnowledgeChatRequest["messages"]
    docs: Awaited<ReturnType<typeof searchKnowledgeDocsService>>
  }) => AsyncIterable<string>
}

const toFrame = (value: unknown) => `${JSON.stringify(value)}\n`

const createImmediateNdjsonResponse = (
  frames: Array<Record<string, unknown>>
) => {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(encoder.encode(toFrame(frame)))
        }

        controller.close()
      },
    }),
    {
      headers: STREAM_HEADERS,
    }
  )
}

const extractLatestUserQuery = (messages: KnowledgeChatRequest["messages"]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (message?.role === "user") {
      return message.content.trim()
    }
  }

  return ""
}

const toCitations = (
  docs: Awaited<ReturnType<typeof searchKnowledgeDocsService>>
) =>
  docs.map(
    (doc): KnowledgeCitation => ({
      id: doc.id,
      title: doc.title,
      path: doc.path,
      updatedAt: doc.updatedAt,
    })
  )

const createContextBlock = (
  docs: Awaited<ReturnType<typeof searchKnowledgeDocsService>>
) =>
  docs
    .map((doc, index) => {
      const notesSection = doc.notes.length
        ? `\nNotes:\n- ${doc.notes.join("\n- ")}`
        : ""

      return [
        `Document ${index + 1}: ${doc.title}`,
        `Path: ${doc.path}`,
        `Updated: ${doc.updatedAt}`,
        `Purpose: ${doc.purpose}`,
        `How to:\n- ${doc.howTo.join("\n- ")}`,
        notesSection,
      ]
        .filter((part) => part.length > 0)
        .join("\n")
    })
    .join("\n\n---\n\n")

const toUnauthorized = (set: RouteSet) => {
  set.status = 401

  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to use knowledge chat.",
  }
}

const toValidationError = (
  set: RouteSet,
  issues: Array<{ path: Array<PropertyKey>; message: string }>
) => {
  set.status = 422

  return {
    ok: false as const,
    error: "VALIDATION_ERROR" as const,
    message: "Please fix the highlighted fields and try again.",
    fieldErrors: fieldErrorMapFromIssues(issues),
  }
}

const streamKnowledgeAnswerDefault = (input: {
  messages: KnowledgeChatRequest["messages"]
  docs: Awaited<ReturnType<typeof searchKnowledgeDocsService>>
}) => {
  const apiKey = process.env.AI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured")
  }

  const modelName =
    process.env.AI_CHAT_MODEL?.trim() || "anthropic/claude-sonnet-4-5-20251120"
  const provider = createOpenRouter({
    apiKey,
    baseURL: process.env.AI_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
  })

  return streamText({
    model: provider.chat(modelName),
    system: [
      "You are 'Tanya P' (Ask P), the official intelligent docs and console assistant for PFNApp.",
      "Answer accurately and directly using the provided knowledge documents.",
      `If the documents are insufficient, reply politely or with "${STRICT_KB_FALLBACK_MESSAGE}".`,
      "Formatting rules:",
      "- When referencing console menus, ALWAYS use the `/console/...` prefix, e.g. [Dasbor WhatsApp](/console/whatsapp/dashboard), [Kelola Template](/console/whatsapp/templates), or [Isi Ulang Saldo](/console/billing/topup).",
      "- When referencing documentation guides, ALWAYS use the `/docs/...` prefix (NEVER bare `/whatsapp/...`), e.g. [Panduan Template Pesan](/docs/whatsapp/templates), [Panduan API Key](/docs/whatsapp/api-keys), or [Panduan Billing](/docs/billing).",
      "- Use step-by-step numbered lists (1., 2.) for action guides.",
      "- Highlight key terms in **bold**.",
      "- Keep answers concise, actionable, and friendly in the user's language.",
      "Knowledge documents:",
      createContextBlock(input.docs),
    ].join("\n"),
    messages: input.messages
      .filter((msg) => Boolean(msg.content && msg.content.trim().length > 0))
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      })),
  }).textStream
}

const createDefaultDependencies = (): KnowledgeRouteDependencies => ({
  authenticate: () => withAuth(),
  searchKnowledgeDocs: searchKnowledgeDocsService,
  streamKnowledgeAnswer: streamKnowledgeAnswerDefault,
})

export const createKnowledgeRoutes = (
  dependencies: KnowledgeRouteDependencies = createDefaultDependencies()
) =>
  new Elysia({ prefix: "/knowledge" }).post(
    "/chat",
    async ({ body, set, headers, request }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const ipAddress =
        (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        (headers["x-real-ip"] as string) ||
        null
      const userAgent = (headers["user-agent"] as string) || null
      const userId = auth.user.id
      const organizationId = auth.organizationId ?? null

      // ── 1. ACTIVE BAN CHECK ───────────────────────────────────────────────
      const activeBan = await checkActiveBan({
        ipAddress,
        userId,
        organizationId,
      })

      if (activeBan.isBanned) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: activeBan.isPermanent
            ? "Your access to AI services has been permanently banned due to security violations."
            : `Your access to AI services is suspended until ${activeBan.blockedUntil?.toISOString()}.`,
          banInfo: activeBan,
        }
      }

      // ── 2. RATE LIMIT CHECK ───────────────────────────────────────────────
      const rateLimit = checkRateLimit(ipAddress, userId)
      if (!rateLimit.allowed) {
        set.status = 429
        return {
          ok: false as const,
          error: "RATE_LIMITED" as const,
          message: `Rate limit exceeded (${rateLimit.reason}). Please retry after ${rateLimit.retryAfterSec}s.`,
          retryAfterSec: rateLimit.retryAfterSec,
        }
      }
      let rawBody = body
      if (!rawBody && request) {
        try {
          rawBody = await request.json()
        } catch {
          // ignore invalid json body
        }
      }

      const parsed = knowledgeChatBodySchema.safeParse(rawBody)

      if (!parsed.success) {
        return toValidationError(set, parsed.error.issues)
      }

      const sessionId = parsed.data.sessionId || randomUUID()
      const routePath = normalizeDocPath(parsed.data.routePath)

      if (!routePath) {
        return toValidationError(set, [
          {
            path: ["routePath"],
            message: "Route path must not be empty.",
          },
        ])
      }

      const latestUserQuery = extractLatestUserQuery(parsed.data.messages)

      // ── 3. PROMPT SAFETY & GUARDRAIL INSPECTION ───────────────────────────
      const safetyCheck = inspectPromptSafety(latestUserQuery)

      if (!safetyCheck.ok) {
        // Record flagged audit message & escalate strike
        try {
          await prisma.aiChatSession.upsert({
            where: { sessionId },
            create: {
              sessionId,
              organizationId,
              userId,
              userEmail: auth.user.email,
              ipAddress,
              userAgent,
              channel: "CONSOLE",
              totalMessages: 1,
              isBlocked: true,
              blockReason: safetyCheck.reason,
            },
            update: {
              totalMessages: { increment: 1 },
              isBlocked: true,
              blockReason: safetyCheck.reason,
            },
          })

          await prisma.aiChatMessage.create({
            data: {
              sessionId,
              role: "user",
              content: latestUserQuery,
              routePath,
              isFlagged: true,
              flagReason: safetyCheck.reason,
              promptTokens: 0,
              responseTokens: 0,
            },
          })

          await recordStrikeAndEscalate({
            sessionId,
            organizationId,
            userId,
            ipAddress,
            reason: safetyCheck.reason || "PROMPT_FLAGGED",
          })
        } catch (err) {
          console.error(
            "[knowledge.route] Failed to record flagged audit:",
            err
          )
        }

        set.status = 422
        return {
          ok: false as const,
          error: "PROMPT_FLAGGED" as const,
          reason: safetyCheck.reason,
          message:
            safetyCheck.message || "Prompt rejected by AI security guardrails.",
          tokensSpent: 0,
        }
      }

      const docs = await dependencies.searchKnowledgeDocs({
        organizationId: auth.organizationId ?? null,
        routePath,
        query: latestUserQuery,
      })
      const highestScore = docs[0]?.score ?? 0

      if (!docs.length || highestScore < MIN_CONTEXT_SCORE) {
        return createImmediateNdjsonResponse([
          {
            type: "delta",
            text: STRICT_KB_FALLBACK_MESSAGE,
          },
          {
            type: "done",
            answer: STRICT_KB_FALLBACK_MESSAGE,
            citations: [],
          },
        ])
      }

      const citations = toCitations(docs)
      const encoder = new TextEncoder()
      let fullAnswer = ""
      const startTime = Date.now()

      const answerStream = dependencies.streamKnowledgeAnswer({
        messages: parsed.data.messages,
        docs,
      })

      return new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const textDelta of answerStream) {
                fullAnswer += textDelta
                controller.enqueue(
                  encoder.encode(
                    toFrame({
                      type: "delta",
                      text: textDelta,
                    })
                  )
                )
              }

              controller.enqueue(
                encoder.encode(
                  toFrame({
                    type: "done",
                    answer: fullAnswer.trim() || STRICT_KB_FALLBACK_MESSAGE,
                    citations,
                  })
                )
              )

              // ── ASYNC AUDIT LOGGING ───────────────────────────────────────
              const durationMs = Date.now() - startTime
              const approxPromptTokens = Math.ceil(latestUserQuery.length / 4)
              const approxResponseTokens = Math.ceil(fullAnswer.length / 4)

              try {
                await prisma.aiChatSession.upsert({
                  where: { sessionId },
                  create: {
                    sessionId,
                    organizationId,
                    userId,
                    userEmail: auth.user?.email ?? null,
                    ipAddress,
                    userAgent,
                    channel: "CONSOLE",
                    totalMessages: 2,
                    totalTokens: approxPromptTokens + approxResponseTokens,
                  },
                  update: {
                    totalMessages: { increment: 2 },
                    totalTokens: {
                      increment: approxPromptTokens + approxResponseTokens,
                    },
                  },
                })

                await prisma.aiChatMessage.createMany({
                  data: [
                    {
                      sessionId,
                      role: "user",
                      content: latestUserQuery,
                      routePath,
                      promptTokens: approxPromptTokens,
                      responseTokens: 0,
                      durationMs: 0,
                    },
                    {
                      sessionId,
                      role: "assistant",
                      content: fullAnswer.trim() || STRICT_KB_FALLBACK_MESSAGE,
                      routePath,
                      promptTokens: 0,
                      responseTokens: approxResponseTokens,
                      durationMs,
                      citations: citations.map((c) => c.id),
                    },
                  ],
                })
              } catch (auditErr) {
                console.error(
                  "[knowledge.route] Audit logging error:",
                  auditErr
                )
              }
            } catch {
              controller.enqueue(
                encoder.encode(
                  toFrame({
                    type: "error",
                    message: "Knowledge chat failed while streaming.",
                  })
                )
              )
            } finally {
              controller.close()
            }
          },
        }),
        {
          headers: STREAM_HEADERS,
        }
      )
    }
  )

export const knowledgeRoutes = createKnowledgeRoutes()
export type App = ReturnType<typeof createKnowledgeRoutes>
