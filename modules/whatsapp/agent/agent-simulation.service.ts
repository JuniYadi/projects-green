import { generateText, stepCountIs, type ModelMessage, type Tool } from "ai"
import { t } from "elysia"
import { logStageFailure } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import {
  getAiBotTimeoutMs,
  isAiBotTimeoutError,
} from "@/modules/ai/ai-bot-timeout"
import {
  resolveAiProviderConfig,
  createAiLanguageModel,
} from "@/modules/ai/ai-provider.factory"
import { buildAgentTools } from "@/modules/ai/agents/ai-agent-tools"
import { parseInteractiveButtons } from "@/modules/whatsapp/ai/ai-interactive-parser"

export const agentSimulateBodySchema = t.Object({
  agentProfileId: t.String(),
  message: t.String(),
  conversationHistory: t.Optional(
    t.Array(
      t.Object({
        role: t.Union([t.Literal("user"), t.Literal("assistant")]),
        content: t.String(),
      })
    )
  ),
  mediaUrl: t.Optional(t.String()),
  mediaType: t.Optional(t.String()),
})

export type ConversationMessage = {
  role: "user" | "assistant"
  content: string
}

export type AgentSimulateInput = {
  agentProfileId: string
  message: string
  conversationHistory?: ConversationMessage[]
  mediaUrl?: string
  mediaType?: string
}

export type InteractiveButton = {
  type: "reply" | "cta_url"
  title: string
  payload?: string
  url?: string
}

export type TracedToolCall = {
  toolName: string
  args: unknown
  output: unknown
  status: "SUCCESS" | "ERROR" | "NOT_FOUND"
  durationMs: number
}

export type SimulationUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
}

export type AgentSimulateSuccess = {
  ok: true
  data: {
    replyText: string
    rawText: string
    interactiveButtons: InteractiveButton[]
    toolCalls: TracedToolCall[]
    usage: SimulationUsage
  }
}

export type AgentSimulateError = {
  ok: false
  error: string
  message: string
  status: number
}

export type AgentSimulateResult = AgentSimulateSuccess | AgentSimulateError

export type SimulationAuthContext = {
  orgId: string
  userId?: string
}

export type AgentSimulationDependencies = {
  findAgent?: (
    id: string,
    orgId: string
  ) => Promise<{
    id: string
    organizationId: string | null
    name: string
    systemPrompt: string
    fallbackMessage: string | null
    allowInteractiveReplies: boolean
    isActive: boolean
  } | null>
  resolveProvider?: typeof resolveAiProviderConfig
  createModel?: typeof createAiLanguageModel
  buildTools?: typeof buildAgentTools
  generate?: typeof generateText
}

const simulationRateLimits = new Map<
  string,
  { count: number; resetAt: number }
>()

export function checkSimulationRateLimit(
  orgId: string,
  limit = 20,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now()

  // Evict expired entries when map grows to avoid memory leaks
  if (simulationRateLimits.size > 50) {
    for (const [id, record] of simulationRateLimits.entries()) {
      if (now > record.resetAt) {
        simulationRateLimits.delete(id)
      }
    }
  }

  const entry = simulationRateLimits.get(orgId)
  if (!entry || now > entry.resetAt) {
    simulationRateLimits.set(orgId, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfterSec }
  }
  entry.count += 1
  return { allowed: true }
}

export function resetSimulationRateLimit(orgId?: string): void {
  if (orgId) {
    simulationRateLimits.delete(orgId)
  } else {
    simulationRateLimits.clear()
  }
}

function isToolNotFoundOutput(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return false
  }
  const record = output as Record<string, unknown>
  if (record.code === "NOT_FOUND" || record.status === 404) {
    return true
  }
  if (
    record.count === 0 &&
    Array.isArray(record.documents) &&
    record.documents.length === 0
  ) {
    return true
  }
  return false
}

function isToolErrorOutput(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return false
  }
  const record = output as Record<string, unknown>
  return record.success === false
}

export async function simulateAgentInference(
  input: AgentSimulateInput,
  auth: SimulationAuthContext,
  deps: AgentSimulationDependencies = {}
): Promise<AgentSimulateResult> {
  if (!input.agentProfileId?.trim() || !input.message?.trim()) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "agentProfileId and message are required and cannot be empty.",
      status: 400,
    }
  }

  const rateCheck = checkSimulationRateLimit(auth.orgId)
  if (!rateCheck.allowed) {
    return {
      ok: false,
      error: "RATE_LIMITED",
      message:
        `Simulation rate limit exceeded. Please retry after ` +
        `${rateCheck.retryAfterSec} seconds.`,
      status: 429,
    }
  }

  const findAgent =
    deps.findAgent ??
    (async (id: string, orgId: string) => {
      return prisma.aiAgentProfile.findFirst({
        where: {
          id,
          organizationId: orgId,
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          systemPrompt: true,
          fallbackMessage: true,
          allowInteractiveReplies: true,
          isActive: true,
        },
      })
    })

  const agent = await findAgent(input.agentProfileId.trim(), auth.orgId)
  if (!agent) {
    return {
      ok: false,
      error: "NOT_FOUND",
      message: "AI Agent profile not found or access denied.",
      status: 404,
    }
  }

  if (!agent.isActive) {
    return {
      ok: false,
      error: "AGENT_INACTIVE",
      message: "AI Agent profile is not active.",
      status: 400,
    }
  }

  const resolveProvider = deps.resolveProvider ?? resolveAiProviderConfig
  const createModel = deps.createModel ?? createAiLanguageModel
  const buildTools = deps.buildTools ?? buildAgentTools
  const generate = deps.generate ?? generateText

  let model
  try {
    const providerConfig = await resolveProvider({
      organizationId: auth.orgId,
    })
    model = createModel(providerConfig)
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Provider configuration failed"
    return {
      ok: false,
      error: "AI_PROVIDER_ERROR",
      message: msg,
      status: 500,
    }
  }

  const baseTools = await buildTools({
    organizationId: auth.orgId,
    agentProfileId: agent.id,
  })

  const toolCalls: TracedToolCall[] = []
  const tracedTools: Record<string, Tool> = {}

  for (const [name, originalTool] of Object.entries(baseTools)) {
    if (typeof originalTool.execute === "function") {
      const origExec = originalTool.execute.bind(originalTool)
      tracedTools[name] = {
        ...originalTool,
        execute: async (args: unknown, options: unknown) => {
          const start = Date.now()
          let status: "SUCCESS" | "ERROR" | "NOT_FOUND" = "SUCCESS"
          let output: unknown
          try {
            output = await origExec(args as never, options as never)
            if (isToolNotFoundOutput(output)) {
              status = "NOT_FOUND"
            } else if (isToolErrorOutput(output)) {
              status = "ERROR"
            }
            return output
          } catch (err: unknown) {
            status = "ERROR"
            const errMessage = err instanceof Error ? err.message : String(err)
            output = { error: errMessage }
            throw err
          } finally {
            const durationMs = Date.now() - start
            toolCalls.push({
              toolName: name,
              args: args ?? {},
              output,
              status,
              durationMs,
            })
          }
        },
      }
    } else {
      tracedTools[name] = originalTool
    }
  }

  const basePrompt =
    agent.systemPrompt?.trim() || "Anda adalah asisten AI toko resmi."

  const interactiveGuidance = agent.allowInteractiveReplies
    ? "\n\n### TOMBOL AKSI INTERAKTIF:\n" +
      "- Anda dapat menyertakan tombol aksi interaktif di akhir balasan " +
      "jika relevan dengan format [BUTTON: Label Singkat] " +
      "(maksimal 3 tombol) atau [URL: Label | https://tautan.com].\n" +
      "- Pastikan label tombol ringkas (maksimal 20 karakter) dan relevan."
    : ""

  const system = [basePrompt, interactiveGuidance].filter(Boolean).join("\n\n")

  const messages: ModelMessage[] = []
  const history = (input.conversationHistory ?? []).slice(-10)
  for (const item of history) {
    if (item.role === "user" || item.role === "assistant") {
      messages.push({
        role: item.role,
        content: item.content,
      })
    }
  }

  const isImage =
    Boolean(input.mediaUrl) &&
    Boolean(
      input.mediaType?.startsWith("image/") ||
      input.mediaUrl?.match(/\.(jpeg|jpg|png|webp|gif)$/i)
    )
  const isPdf =
    Boolean(input.mediaUrl) &&
    Boolean(
      input.mediaType === "application/pdf" ||
      input.mediaUrl?.toLowerCase().endsWith(".pdf")
    )

  if (isImage && input.mediaUrl) {
    try {
      const imageUrl = new URL(input.mediaUrl)
      messages.push({
        role: "user",
        content: [
          { type: "text", text: input.message },
          { type: "image", image: imageUrl },
        ],
      })
    } catch {
      messages.push({
        role: "user",
        content: input.message,
      })
    }
  } else if (isPdf && input.mediaUrl) {
    messages.push({
      role: "user",
      content: `[Dokumen PDF terlampir]: ${input.message}`,
    })
  } else {
    messages.push({
      role: "user",
      content: input.message,
    })
  }

  const overallStart = Date.now()
  let aiResult: Awaited<ReturnType<typeof generateText>>
  try {
    aiResult = await generate({
      model,
      system,
      messages,
      tools: tracedTools,
      stopWhen: stepCountIs(5),
      timeout: getAiBotTimeoutMs(),
      ...({ maxSteps: 5 } as Record<string, unknown>),
    })
  } catch (err: unknown) {
    const latencyMs = Date.now() - overallStart
    const timedOut = isAiBotTimeoutError(err)
    const errorMessage =
      err instanceof Error ? err.message : "Inference execution failed"
    const fallbackMessage = agent.fallbackMessage?.trim()

    logStageFailure({
      agentProfileId: agent.id,
      channel: "CONSOLE",
      stage: "GENERATION",
      error: err,
    })

    return {
      ok: false,
      error: timedOut ? "TIMEOUT" : "INFERENCE_ERROR",
      message: fallbackMessage
        ? `${errorMessage} (latency: ${latencyMs}ms) — ` +
          `fallback: ${fallbackMessage}`
        : `${errorMessage} (latency: ${latencyMs}ms)`,
      status: 500,
    }
  }
  const latencyMs = Date.now() - overallStart

  const rawText =
    aiResult.text?.trim() ||
    agent.fallbackMessage?.trim() ||
    "Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."

  const { cleanText, buttons } = parseInteractiveButtons(rawText)
  const replyText = cleanText || rawText

  const interactiveButtons: InteractiveButton[] = buttons.map((b) => ({
    type: b.type === "url" ? ("cta_url" as const) : ("reply" as const),
    title: b.title,
    ...(b.type === "url" ? { url: b.url } : { payload: b.id }),
  }))

  const promptTokens =
    (aiResult.usage as { promptTokens?: number })?.promptTokens ?? 0
  const completionTokens =
    (aiResult.usage as { completionTokens?: number })?.completionTokens ?? 0
  const totalTokens =
    (aiResult.usage as { totalTokens?: number })?.totalTokens ??
    promptTokens + completionTokens

  return {
    ok: true,
    data: {
      replyText,
      rawText,
      interactiveButtons,
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
      },
    },
  }
}
