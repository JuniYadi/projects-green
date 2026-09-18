import { createOpenAI } from "@ai-sdk/openai"
import { type Prisma, type PrismaClient } from "@prisma/client"
import { stepCountIs, streamText, tool } from "ai"
import { z } from "zod"

import { getAiProviderConfig } from "@/lib/ai-config"
import { prisma } from "@/lib/prisma"
import {
  AiDeploymentSessionError,
  type AiDeploymentSessionActor,
} from "@/modules/deploy/ai-deployment-session.service"
import { formatTunablesForAiPrompt } from "@/modules/framework-detection/platform-runtime-contract"

export const BLUEPRINT_FIELD_ENUM = z.enum([
  "port",
  "startCommand",
  "computeTier",
  "subdomain",
  "rootDirectory",
])

export type BlueprintField = z.infer<typeof BLUEPRINT_FIELD_ENUM>

export const UPDATE_BLUEPRINT_FIELD_SCHEMA = z.object({
  field: BLUEPRINT_FIELD_ENUM,
  value: z.union([z.string(), z.number()]),
  reason: z.string().optional(),
})

export type UpdateBlueprintFieldInput = z.infer<
  typeof UPDATE_BLUEPRINT_FIELD_SCHEMA
>

export const ADD_ENVIRONMENT_VARIABLE_SCHEMA = z.object({
  key: z.string().trim().min(1),
  value: z.string(),
  isSecret: z.boolean().default(false),
})

export type AddEnvironmentVariableInput = z.infer<
  typeof ADD_ENVIRONMENT_VARIABLE_SCHEMA
>

export type DeploymentBlueprint = {
  port?: number
  startCommand?: string
  computeTier?: string
  subdomain?: string
  rootDirectory?: string
  environmentVariables?: Array<{
    key: string
    value: string
    isSecret?: boolean
  }>
  envVars?: Record<string, string>
  [key: string]: unknown
}

export type AiSessionChatEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolName: string; args: unknown }
  | { type: "tool-result"; toolName: string; result: unknown }
  | { type: "error"; error: string }
  | { type: "finish"; finishReason?: string }

export type AiSessionChatResult = {
  sessionId: string
  textStream: AsyncIterable<string>
  fullStream: AsyncIterable<AiSessionChatEvent>
  events: AiSessionChatEvent[]
  toResponse: (init?: ResponseInit) => Response
  toTextStreamResponse: (init?: ResponseInit) => Response
  [Symbol.asyncIterator]: () => AsyncIterator<string>
}

export type HandleSessionChatInput = {
  actor: AiDeploymentSessionActor
  sessionId: string
  message: string
  messages?: Array<{ role: "user" | "assistant"; content: string }>
}

export type AiSessionChatDependencies = {
  db?: PrismaClient
  createOpenAI?: typeof createOpenAI
  streamText?: typeof streamText
  getAiConfig?: typeof getAiProviderConfig
  model?: string
  now?: () => Date
}

export const TANYA_P_SYSTEM_PROMPT = `You are Tanya P (AI Deploy Helper), the dedicated deployment copilot on the Green cloud platform.
Your persona:
- Direct, helpful, friendly, and concise.
- Bilingual: answer in Indonesian when the user writes in Indonesian or asks in Indonesian. Answer in English when the user writes in English.
- Proactively explain recommendations when asked.

Your role in Fase 1 (In-Stream Dialogue):
- Guide developers in reviewing and adjusting their deployment blueprint before launch.
- You have two mutation tools to update the blueprint:
  1. update_blueprint_field({ field, value, reason }): modifies "port", "startCommand", "computeTier", "subdomain", or "rootDirectory".
  2. add_environment_variable({ key, value, isSecret }): adds or updates an environment variable.
- Whenever a user asks to change or update any of these fields (e.g. "ganti port jadi 8080", "set compute tier to medium", "tambah env FOO=bar"), immediately call the appropriate mutation tool.
- Confirm changes concisely after executing tool calls.

Platform Runtime Operational Contract & Troubleshooting Knowledge:
- Container workloads use hardened, unprivileged base images (listening on port 8080 as non-root UID 10001).
- If a user asks about uploading large files or HTTP 413 (Payload Too Large) in Laravel / PHP:
  Instruct them to add both PHP_UPLOAD_MAX_FILESIZE and PHP_POST_MAX_SIZE (e.g. 100M). You can call add_environment_variable for them!
- If a user asks about memory exhaustion in PHP:
  Instruct them to set PHP_MEMORY_LIMIT (e.g. 512M).
- If a user asks about queue workers, background jobs, Horizon, or scheduler in Laravel:
  Inform them that the base image supports CONTAINER_ROLE ("worker", "horizon", "scheduler", "all") without separate Dockerfiles.
- If a user asks about Next.js / Node / Bun server ports:
  Inform them the platform listens on port 8080 by default.
`

export function extractBlueprintFromSession(
  session: unknown
): DeploymentBlueprint {
  const s = session as Record<string, unknown> | null | undefined
  if (!s) return {}

  let bp: Record<string, unknown> = {}

  if (s.blueprint && typeof s.blueprint === "object") {
    bp = { ...(s.blueprint as Record<string, unknown>) }
  } else if (s.initialPlan && typeof s.initialPlan === "object") {
    bp = { ...(s.initialPlan as Record<string, unknown>) }
  } else {
    const serverContext = s.serverContext as
      Record<string, unknown> | null | undefined
    if (
      serverContext?.blueprint &&
      typeof serverContext.blueprint === "object"
    ) {
      bp = { ...(serverContext.blueprint as Record<string, unknown>) }
    } else if (
      serverContext?.initialPlan &&
      typeof serverContext.initialPlan === "object"
    ) {
      bp = { ...(serverContext.initialPlan as Record<string, unknown>) }
    } else {
      const plan = s.plan as Record<string, unknown> | null | undefined
      if (plan && typeof plan === "object") {
        if (plan.blueprint && typeof plan.blueprint === "object") {
          bp = { ...(plan.blueprint as Record<string, unknown>) }
        } else {
          const detection = plan.detection as
            Record<string, unknown> | undefined
          const resources = plan.resources as
            Record<string, unknown> | undefined
          const domain = plan.domain as Record<string, unknown> | undefined
          const config = plan.configuration as
            Record<string, unknown> | undefined
          bp = {
            port:
              typeof detection?.port === "number" ? detection.port : undefined,
            startCommand: Array.isArray(detection?.commands)
              ? detection.commands[1] || detection.commands[0]
              : undefined,
            computeTier:
              typeof resources?.package === "string"
                ? resources.package
                : undefined,
            subdomain:
              typeof domain?.hostname === "string"
                ? domain.hostname
                : typeof config?.appName === "string"
                  ? config.appName
                  : undefined,
            rootDirectory:
              typeof (plan.source as Record<string, unknown> | undefined)
                ?.subpath === "string"
                ? (plan.source as Record<string, unknown>).subpath
                : undefined,
            ...plan,
          }
        }
      }
    }
  }

  const envList: Array<{ key: string; value: string; isSecret?: boolean }> = []
  if (Array.isArray(bp.environmentVariables)) {
    for (const item of bp.environmentVariables) {
      if (item && typeof item === "object" && typeof item.key === "string") {
        envList.push({
          key: item.key,
          value: String(item.value ?? ""),
          isSecret: Boolean(item.isSecret),
        })
      }
    }
  }

  const envRecord: Record<string, string> = {}
  if (bp.envVars && typeof bp.envVars === "object") {
    for (const [k, v] of Object.entries(
      bp.envVars as Record<string, unknown>
    )) {
      envRecord[k] = String(v ?? "")
      if (!envList.some((e) => e.key === k)) {
        envList.push({ key: k, value: String(v ?? ""), isSecret: false })
      }
    }
  } else {
    for (const item of envList) {
      envRecord[item.key] = item.value
    }
  }

  return {
    ...bp,
    port: typeof bp.port === "number" ? bp.port : undefined,
    startCommand:
      typeof bp.startCommand === "string" ? bp.startCommand : undefined,
    computeTier:
      typeof bp.computeTier === "string" ? bp.computeTier : undefined,
    subdomain: typeof bp.subdomain === "string" ? bp.subdomain : undefined,
    rootDirectory:
      typeof bp.rootDirectory === "string" ? bp.rootDirectory : undefined,
    environmentVariables: envList,
    envVars: envRecord,
  }
}

export async function persistBlueprintToDb(
  db: PrismaClient,
  sessionId: string,
  blueprint: DeploymentBlueprint
): Promise<void> {
  const current = await db.aiDeploymentSession.findUnique({
    where: { id: sessionId },
  })
  if (!current) return

  const prevServerContext = (
    current.serverContext && typeof current.serverContext === "object"
      ? current.serverContext
      : {}
  ) as Record<string, unknown>

  const nextServerContext = {
    ...prevServerContext,
    blueprint,
  }

  const prevPlan = (
    current.plan && typeof current.plan === "object" ? current.plan : {}
  ) as Record<string, unknown>

  const nextPlan: Record<string, unknown> = {
    ...prevPlan,
    ...blueprint,
    blueprint,
  }

  if (
    blueprint.port !== undefined &&
    prevPlan.detection &&
    typeof prevPlan.detection === "object"
  ) {
    nextPlan.detection = {
      ...(prevPlan.detection as Record<string, unknown>),
      port: blueprint.port,
    }
  }

  if (
    blueprint.startCommand !== undefined &&
    prevPlan.detection &&
    typeof prevPlan.detection === "object"
  ) {
    const prevDetection = prevPlan.detection as Record<string, unknown>
    const prevCommands = Array.isArray(prevDetection.commands)
      ? [...prevDetection.commands]
      : [""]
    if (prevCommands.length > 1) {
      prevCommands[1] = blueprint.startCommand
    } else {
      prevCommands[0] = blueprint.startCommand
    }
    nextPlan.detection = {
      ...prevDetection,
      commands: prevCommands,
    }
  }

  if (
    blueprint.computeTier !== undefined &&
    prevPlan.resources &&
    typeof prevPlan.resources === "object"
  ) {
    nextPlan.resources = {
      ...(prevPlan.resources as Record<string, unknown>),
      package: blueprint.computeTier,
    }
  }

  if (
    blueprint.subdomain !== undefined &&
    prevPlan.domain &&
    typeof prevPlan.domain === "object"
  ) {
    nextPlan.domain = {
      ...(prevPlan.domain as Record<string, unknown>),
      hostname: blueprint.subdomain,
    }
  }

  const data: Record<string, unknown> = {
    plan: nextPlan as Prisma.InputJsonValue,
    serverContext: nextServerContext as Prisma.InputJsonValue,
  }

  if ("blueprint" in current) {
    data.blueprint = blueprint
  }

  await db.aiDeploymentSession.update({
    where: { id: sessionId },
    data: data as Prisma.AiDeploymentSessionUpdateInput,
  })
}

export function createBlueprintMutationTools(params: {
  sessionId: string
  activeBlueprint: DeploymentBlueprint
  db: PrismaClient
  onMutation?: (event: {
    type: "field_update" | "env_add"
    field?: string
    key?: string
    value: unknown
    reason?: string
    isSecret?: boolean
    blueprint: DeploymentBlueprint
  }) => void
}) {
  const { sessionId, activeBlueprint, db, onMutation } = params

  return {
    update_blueprint_field: tool({
      description:
        "Update a field in the active deployment blueprint. Supported fields: port, startCommand, computeTier, subdomain, rootDirectory.",
      inputSchema: UPDATE_BLUEPRINT_FIELD_SCHEMA,
      execute: async ({ field, value, reason }) => {
        let normalizedValue: string | number = value
        if (field === "port") {
          normalizedValue =
            typeof value === "number" ? value : parseInt(String(value), 10)
          if (Number.isNaN(normalizedValue)) {
            normalizedValue = 3000
          }
          activeBlueprint.port = normalizedValue
        } else if (field === "startCommand") {
          activeBlueprint.startCommand = String(value)
        } else if (field === "computeTier") {
          activeBlueprint.computeTier = String(value)
        } else if (field === "subdomain") {
          activeBlueprint.subdomain = String(value)
        } else if (field === "rootDirectory") {
          activeBlueprint.rootDirectory = String(value)
        }

        await persistBlueprintToDb(db, sessionId, activeBlueprint)

        onMutation?.({
          type: "field_update",
          field,
          value: normalizedValue,
          reason,
          blueprint: activeBlueprint,
        })

        return {
          success: true,
          field,
          value: normalizedValue,
          reason: reason ?? null,
          blueprint: activeBlueprint,
        }
      },
    }),

    add_environment_variable: tool({
      description:
        "Add or update an environment variable in the deployment blueprint.",
      inputSchema: ADD_ENVIRONMENT_VARIABLE_SCHEMA,
      execute: async ({ key, value, isSecret = false }) => {
        if (!Array.isArray(activeBlueprint.environmentVariables)) {
          activeBlueprint.environmentVariables = []
        }
        const existingIndex = activeBlueprint.environmentVariables.findIndex(
          (item) => item.key === key
        )
        if (existingIndex >= 0) {
          activeBlueprint.environmentVariables[existingIndex] = {
            key,
            value,
            isSecret,
          }
        } else {
          activeBlueprint.environmentVariables.push({
            key,
            value,
            isSecret,
          })
        }

        if (
          !activeBlueprint.envVars ||
          typeof activeBlueprint.envVars !== "object"
        ) {
          activeBlueprint.envVars = {}
        }
        ;(activeBlueprint.envVars as Record<string, string>)[key] = value

        await persistBlueprintToDb(db, sessionId, activeBlueprint)

        onMutation?.({
          type: "env_add",
          key,
          value: isSecret ? "********" : value,
          isSecret,
          blueprint: activeBlueprint,
        })

        return {
          success: true,
          key,
          isSecret,
          blueprint: activeBlueprint,
        }
      },
    }),
  }
}

export class AiSessionChatService {
  private readonly db: PrismaClient
  private readonly now: () => Date

  constructor(private readonly deps: AiSessionChatDependencies = {}) {
    this.db = deps.db ?? prisma
    this.now = deps.now ?? (() => new Date())
  }

  async handleSessionChat(
    input: HandleSessionChatInput
  ): Promise<AiSessionChatResult> {
    const session = await this.db.aiDeploymentSession.findFirst({
      where: {
        id: input.sessionId,
        organizationId: input.actor.organizationId,
      },
    })
    if (!session) {
      throw new AiDeploymentSessionError("NOT_FOUND")
    }
    if (session.expiresAt && session.expiresAt <= this.now()) {
      throw new AiDeploymentSessionError("SESSION_EXPIRED")
    }

    const activeBlueprint = extractBlueprintFromSession(session)
    const trackedEvents: AiSessionChatEvent[] = []

    const tools = createBlueprintMutationTools({
      sessionId: input.sessionId,
      activeBlueprint,
      db: this.db,
      onMutation: (ev) => {
        trackedEvents.push({
          type: "tool-call",
          toolName:
            ev.type === "field_update"
              ? "update_blueprint_field"
              : "add_environment_variable",
          args: ev,
        })
        trackedEvents.push({
          type: "tool-result",
          toolName:
            ev.type === "field_update"
              ? "update_blueprint_field"
              : "add_environment_variable",
          result: { success: true, blueprint: ev.blueprint },
        })
      },
    })

    const conversationMessages: Array<{
      role: "user" | "assistant"
      content: string
    }> = []
    if (input.messages && input.messages.length > 0) {
      conversationMessages.push(...input.messages)
    }
    const lastMessage = conversationMessages[conversationMessages.length - 1]
    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.content !== input.message
    ) {
      if (
        input.message &&
        (!lastMessage || lastMessage.content !== input.message)
      ) {
        conversationMessages.push({ role: "user", content: input.message })
      }
    }

    let aiConfig: { apiKey: string; baseURL: string } | null = null
    try {
      const getAiConfig = this.deps.getAiConfig ?? getAiProviderConfig
      aiConfig = getAiConfig()
    } catch {
      aiConfig = null
    }

    if (aiConfig && aiConfig.apiKey) {
      try {
        const createProvider = this.deps.createOpenAI ?? createOpenAI
        const provider = createProvider(aiConfig)
        const modelName =
          this.deps.model ??
          (process.env.AI_CHAT_MODEL?.trim() || "gpt-4.1-mini")
        const streamFn = this.deps.streamText ?? streamText

        const framework =
          (activeBlueprint as Record<string, unknown> | undefined)?.framework ??
          (activeBlueprint as Record<string, unknown> | undefined)?.frameworkId
        const runtimeKnowledge = formatTunablesForAiPrompt(
          typeof framework === "string" ? framework : undefined
        )

        const systemPrompt = `${TANYA_P_SYSTEM_PROMPT}\n\n${runtimeKnowledge}\n\nCurrent deployment blueprint:\n${JSON.stringify(activeBlueprint, null, 2)}`

        const streamResult = streamFn({
          model: provider(modelName),
          system: systemPrompt,
          messages: conversationMessages,
          tools,
          stopWhen: stepCountIs(5),
        })

        return this.wrapAiStreamResult(
          input.sessionId,
          streamResult,
          trackedEvents
        )
      } catch {
        // Fall back to offline generator
      }
    }

    return this.runFallbackChat(
      input.sessionId,
      input.message,
      tools,
      trackedEvents,
      activeBlueprint
    )
  }

  private wrapAiStreamResult(
    sessionId: string,
    streamResult: {
      textStream: AsyncIterable<string>
      fullStream?: AsyncIterable<any>
      toTextStreamResponse?: (init?: ResponseInit) => Response
    },
    trackedEvents: AiSessionChatEvent[]
  ): AiSessionChatResult {
    async function* mapFullStream(): AsyncIterable<AiSessionChatEvent> {
      if (streamResult.fullStream) {
        for await (const part of streamResult.fullStream) {
          if (part.type === "text-delta") {
            const ev: AiSessionChatEvent = {
              type: "text-delta",
              text: part.text ?? part.textDelta ?? "",
            }
            trackedEvents.push(ev)
            yield ev
          } else if (part.type === "tool-call") {
            const ev: AiSessionChatEvent = {
              type: "tool-call",
              toolName: part.toolName,
              args: part.args ?? part.input,
            }
            trackedEvents.push(ev)
            yield ev
          } else if (part.type === "tool-result") {
            const ev: AiSessionChatEvent = {
              type: "tool-result",
              toolName: part.toolName,
              result: part.result ?? part.output,
            }
            trackedEvents.push(ev)
            yield ev
          } else if (part.type === "finish") {
            const ev: AiSessionChatEvent = {
              type: "finish",
              finishReason: part.finishReason,
            }
            trackedEvents.push(ev)
            yield ev
          }
        }
      }
    }

    const toResponse = (init?: ResponseInit): Response => {
      if (typeof streamResult.toTextStreamResponse === "function") {
        return streamResult.toTextStreamResponse(init)
      }
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for await (const chunk of streamResult.textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-cache",
          ...(init?.headers ?? {}),
        },
        status: init?.status ?? 200,
        statusText: init?.statusText,
      })
    }

    return {
      sessionId,
      textStream: streamResult.textStream,
      fullStream: mapFullStream(),
      events: trackedEvents,
      toResponse,
      toTextStreamResponse: toResponse,
      [Symbol.asyncIterator]() {
        return streamResult.textStream[Symbol.asyncIterator]()
      },
    }
  }

  private async runFallbackChat(
    sessionId: string,
    message: string,
    tools: ReturnType<typeof createBlueprintMutationTools>,
    trackedEvents: AiSessionChatEvent[],
    _activeBlueprint: DeploymentBlueprint
  ): Promise<AiSessionChatResult> {
    const isIndonesian =
      /halo|ganti|ubah|tambah|bisa|tolong|kenapa|apakah|port|jalankan|siap/i.test(
        message
      )

    let responseText = ""

    const portMatch = message.match(/(?:ganti\s+)?port\s*(?:ke|to|=)?\s*(\d+)/i)
    const startCommandMatch = message.match(
      /(?:start\s*command|perintah\s*start|jalankan\s*dengan)\s*(?:ke|to|=)?\s*["']?([^"'\n]+)["']?/i
    )
    const tierMatch = message.match(
      /(?:compute\s*tier|tier)\s*(?:ke|to|=)?\s*(starter|pro|small|medium|large)/i
    )
    const subdomainMatch = message.match(
      /(?:subdomain|domain)\s*(?:ke|to|=)?\s*([a-z0-9-]+)/i
    )
    const rootDirMatch = message.match(
      /(?:root\s*dir(?:ectory)?|direktori)\s*(?:ke|to|=)?\s*([a-zA-Z0-9_./-]+)/i
    )
    const envMatch = message.match(
      /(?:tambah|add|set)?\s*(?:env|secret)?\s*([A-Za-z_][A-Za-z0-9_]*)=([^\s]+)/i
    )

    const isSecret = /secret|rahasia/i.test(message)

    if (portMatch) {
      const port = parseInt(portMatch[1], 10)
      const exec = tools.update_blueprint_field.execute as (
        args: { field: "port"; value: number; reason?: string },
        ctx?: unknown
      ) => Promise<unknown>
      await exec({
        field: "port",
        value: port,
        reason: "User commanded port change",
      })
      responseText = isIndonesian
        ? `Port aplikasi telah berhasil diperbarui ke ${port}.`
        : `Application port has been successfully updated to ${port}.`
    } else if (startCommandMatch) {
      const cmd = startCommandMatch[1].trim()
      const exec = tools.update_blueprint_field.execute as (
        args: { field: "startCommand"; value: string; reason?: string },
        ctx?: unknown
      ) => Promise<unknown>
      await exec({
        field: "startCommand",
        value: cmd,
        reason: "User commanded startCommand change",
      })
      responseText = isIndonesian
        ? `Start command telah diperbarui menjadi "${cmd}".`
        : `Start command has been updated to "${cmd}".`
    } else if (tierMatch) {
      const tier = tierMatch[1].toLowerCase()
      const exec = tools.update_blueprint_field.execute as (
        args: { field: "computeTier"; value: string; reason?: string },
        ctx?: unknown
      ) => Promise<unknown>
      await exec({
        field: "computeTier",
        value: tier,
        reason: "User commanded computeTier change",
      })
      responseText = isIndonesian
        ? `Compute tier telah diubah ke ${tier}.`
        : `Compute tier has been updated to ${tier}.`
    } else if (subdomainMatch) {
      const sub = subdomainMatch[1].toLowerCase()
      const exec = tools.update_blueprint_field.execute as (
        args: { field: "subdomain"; value: string; reason?: string },
        ctx?: unknown
      ) => Promise<unknown>
      await exec({
        field: "subdomain",
        value: sub,
        reason: "User commanded subdomain change",
      })
      responseText = isIndonesian
        ? `Subdomain telah diubah menjadi "${sub}".`
        : `Subdomain has been updated to "${sub}".`
    } else if (rootDirMatch) {
      const dir = rootDirMatch[1]
      const exec = tools.update_blueprint_field.execute as (
        args: { field: "rootDirectory"; value: string; reason?: string },
        ctx?: unknown
      ) => Promise<unknown>
      await exec({
        field: "rootDirectory",
        value: dir,
        reason: "User commanded rootDirectory change",
      })
      responseText = isIndonesian
        ? `Root directory telah diatur ke "${dir}".`
        : `Root directory has been set to "${dir}".`
    } else if (envMatch && envMatch[1] && envMatch[2]) {
      const key = envMatch[1]
      const val = envMatch[2]
      const exec = tools.add_environment_variable.execute as (
        args: { key: string; value: string; isSecret?: boolean },
        ctx?: unknown
      ) => Promise<unknown>
      await exec({
        key,
        value: val,
        isSecret,
      })
      responseText = isIndonesian
        ? `Environment variable ${key} berhasil disimpan ke blueprint.`
        : `Environment variable ${key} successfully added to blueprint.`
    } else {
      responseText = isIndonesian
        ? `Halo! Saya Tanya P, asisten deployment Anda. Blueprint aplikasi saat ini sudah siap. Anda dapat meminta saya untuk mengubah port, start command, compute tier, subdomain, atau menambahkan variabel environment.`
        : `Hello! I am Tanya P, your deployment copilot. The current application blueprint is ready. You can ask me to change the port, start command, compute tier, subdomain, or add environment variables.`
    }

    const chunks = responseText.split(" ")
    async function* textStream(): AsyncIterable<string> {
      for (let i = 0; i < chunks.length; i++) {
        const delta = (i === 0 ? "" : " ") + chunks[i]
        trackedEvents.push({ type: "text-delta", text: delta })
        yield delta
      }
      trackedEvents.push({ type: "finish", finishReason: "stop" })
    }

    async function* fullStream(): AsyncIterable<AiSessionChatEvent> {
      for (const ev of trackedEvents) {
        yield ev
      }
    }

    const encoder = new TextEncoder()
    const toResponse = (init?: ResponseInit): Response => {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for await (const chunk of textStream()) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-cache",
          ...(init?.headers ?? {}),
        },
        status: init?.status ?? 200,
        statusText: init?.statusText,
      })
    }

    return {
      sessionId,
      textStream: textStream(),
      fullStream: fullStream(),
      events: trackedEvents,
      toResponse,
      toTextStreamResponse: toResponse,
      [Symbol.asyncIterator]() {
        return textStream()[Symbol.asyncIterator]()
      },
    }
  }
}

export const defaultAiSessionChatService = new AiSessionChatService()

export const handleSessionChat = (input: HandleSessionChatInput) =>
  defaultAiSessionChatService.handleSessionChat(input)
