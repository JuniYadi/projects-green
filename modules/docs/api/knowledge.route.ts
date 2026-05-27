import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText } from "ai"
import { z } from "zod"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  normalizeDocPath,
  searchKnowledgeDocs as searchKnowledgeDocsService,
} from "@/modules/docs/docs.service"
import type {
  KnowledgeChatRequest,
  KnowledgeCitation,
} from "@/modules/docs/docs.types"

const knowledgeChatBodySchema = z.object({
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
const MIN_CONTEXT_SCORE = 12

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

  const modelName = process.env.AI_CHAT_MODEL?.trim() || "anthropic/claude-sonnet-4-5-20251120"
  const provider = createOpenRouter({
    apiKey,
    baseURL: process.env.AI_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
  })

  return streamText({
    model: provider.chat(modelName),
    system: [
      "You are a private product knowledgebase assistant.",
      "Only answer from the provided knowledge documents.",
      `If the documents are insufficient, reply exactly: "${STRICT_KB_FALLBACK_MESSAGE}"`,
      "Keep answers concise and actionable.",
      "",
      "Knowledge documents:",
      createContextBlock(input.docs),
    ].join("\n"),
    messages: input.messages.map((message) => ({
      role: message.role,
      content: message.content,
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
    async ({ body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const parsed = knowledgeChatBodySchema.safeParse(body)

      if (!parsed.success) {
        return toValidationError(set, parsed.error.issues)
      }

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
      const docs = await dependencies.searchKnowledgeDocs({
        organizationId: auth.organizationId ?? null,
        routePath,
        query: latestUserQuery,
      })
      const citations = toCitations(docs)
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

      const encoder = new TextEncoder()
      let fullAnswer = ""

      try {
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
      } catch (error) {
        set.status = 500

        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message:
            error instanceof Error
              ? error.message
              : "Knowledge chat failed to initialize.",
        }
      }
    },
    {
      body: knowledgeChatBodySchema,
    }
  )

export const knowledgeRoutes = createKnowledgeRoutes()
export type App = ReturnType<typeof createKnowledgeRoutes>
