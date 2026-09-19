import { tool, type Tool } from "ai"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { searchHybridKnowledge } from "@/modules/ai/ai-rag.service"
import { invokeConnection } from "@/modules/ai/connections/connection.service"

export interface ToolExecutionAuditParams {
  organizationId?: string | null
  agentProfileId?: string | null
  sessionId?: string | null
  toolName: string
  input: unknown
  output: unknown
  durationMs: number
  status: "SUCCESS" | "ERROR" | "NOT_FOUND"
  errorMessage?: string | null
}

export async function logToolExecutionAudit(
  auditData: ToolExecutionAuditParams
): Promise<void> {
  try {
    const client = prisma as unknown as {
      aiUsageAudit?: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>
      }
    }
    if (
      client.aiUsageAudit &&
      typeof client.aiUsageAudit.create === "function"
    ) {
      await client.aiUsageAudit.create({
        data: {
          organizationId: auditData.organizationId ?? null,
          agentProfileId: auditData.agentProfileId ?? null,
          sessionId: auditData.sessionId ?? null,
          toolName: auditData.toolName,
          input:
            typeof auditData.input === "string"
              ? auditData.input
              : JSON.stringify(auditData.input),
          output:
            typeof auditData.output === "string"
              ? auditData.output
              : JSON.stringify(auditData.output),
          durationMs: auditData.durationMs,
          status: auditData.status,
          errorMessage: auditData.errorMessage ?? null,
          createdAt: new Date(),
        },
      })
    }
  } catch (err) {
    // Graceful fallback if aiUsageAudit table is not present in schema
    console.warn("[ai-agent-tools] Audit logging fallback:", err)
  }
}

export interface QueryKnowledgeBaseToolOptions {
  organizationId: string
  agentProfileId?: string | null
  sessionId?: string | null
}

export const QUERY_KNOWLEDGE_BASE_SCHEMA = z.object({
  query: z
    .string()
    .describe("Kata kunci atau pertanyaan untuk dicari di basis pengetahuan"),
  limit: z
    .number()
    .optional()
    .describe("Maksimum jumlah dokumen yang diambil (default 3)"),
})

export function createQueryKnowledgeBaseTool(
  options: QueryKnowledgeBaseToolOptions
): Tool {
  return tool({
    description:
      "Cari informasi resmi dari basis pengetahuan internal organisasi " +
      "(RAG hybrid cosine + BM25) seperti SOP, kebijakan, harga, atau panduan.",
    inputSchema: QUERY_KNOWLEDGE_BASE_SCHEMA,
    execute: async ({ query, limit }) => {
      const startTime = Date.now()
      try {
        const results = await searchHybridKnowledge({
          organizationId: options.organizationId,
          agentProfileId: options.agentProfileId ?? undefined,
          query,
          limit: limit ?? 3,
        })
        const durationMs = Date.now() - startTime

        if (!results || results.length === 0) {
          const fallback = {
            success: true,
            count: 0,
            documents: [],
            message:
              "Tidak ditemukan dokumen relevan di basis pengetahuan " +
              "untuk pertanyaan tersebut.",
          }
          await logToolExecutionAudit({
            organizationId: options.organizationId,
            agentProfileId: options.agentProfileId,
            sessionId: options.sessionId,
            toolName: "queryKnowledgeBase",
            input: { query, limit },
            output: fallback,
            durationMs,
            status: "NOT_FOUND",
          })
          return fallback
        }

        const formatted = {
          success: true,
          count: results.length,
          documents: results.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            content: r.contentMarkdown,
          })),
        }

        await logToolExecutionAudit({
          organizationId: options.organizationId,
          agentProfileId: options.agentProfileId,
          sessionId: options.sessionId,
          toolName: "queryKnowledgeBase",
          input: { query, limit },
          output: formatted,
          durationMs,
          status: "SUCCESS",
        })

        return formatted
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : String(err)
        const errorResult = {
          success: false,
          error: "KNOWLEDGE_SEARCH_ERROR",
          message: "Gagal mengakses basis pengetahuan.",
        }

        await logToolExecutionAudit({
          organizationId: options.organizationId,
          agentProfileId: options.agentProfileId,
          sessionId: options.sessionId,
          toolName: "queryKnowledgeBase",
          input: { query, limit },
          output: errorResult,
          durationMs,
          status: "ERROR",
          errorMessage,
        })

        return errorResult
      }
    },
  })
}

export interface CreateConnectionApiToolOptions {
  organizationId: string
  connectionId: string
  connectionName: string
  subpath?: string
  method?: string
  description?: string
  inputSchema?: z.ZodTypeAny
  sessionId?: string
  timeoutMs?: number
  invokeConnectionFn?: typeof invokeConnection
}

export const DEFAULT_API_INPUT_SCHEMA = z.object({
  subpath: z
    .string()
    .optional()
    .describe("Subpath atau URL endpoint tambahan"),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("Parameter query URL"),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Payload body request"),
})

export function createConnectionApiTool(
  options: CreateConnectionApiToolOptions
): Tool {
  const schema = options.inputSchema ?? DEFAULT_API_INPUT_SCHEMA
  const method = (options.method ?? "GET").toUpperCase()
  const timeoutMs = options.timeoutMs ?? 8000

  return tool({
    description:
      options.description ||
      `Panggil API integrasi '${options.connectionName}' untuk memeriksa data.`,
    inputSchema: schema,
    execute: async (input: unknown) => {
      const startTime = Date.now()
      try {
        let subpath = options.subpath
        let queryParams: Record<string, string | number | boolean> | undefined
        let body: unknown

        if (input && typeof input === "object") {
          const record = input as Record<string, unknown>
          if (typeof record.subpath === "string" && record.subpath) {
            subpath = record.subpath
          }

          if (method === "GET" || method === "DELETE") {
            if (
              record.params &&
              typeof record.params === "object" &&
              !Array.isArray(record.params)
            ) {
              queryParams = record.params as Record<
                string,
                string | number | boolean
              >
            } else {
              const entries = Object.entries(record).filter(
                ([k, v]) =>
                  k !== "subpath" &&
                  k !== "body" &&
                  (typeof v === "string" ||
                    typeof v === "number" ||
                    typeof v === "boolean")
              )
              if (entries.length > 0) {
                queryParams = Object.fromEntries(entries) as Record<
                  string,
                  string | number | boolean
                >
              }
            }
          } else {
            if (record.body !== undefined) {
              body = record.body
            } else {
              const { subpath: _, ...rest } = record
              body = rest
            }
          }
        }

        const invoker = options.invokeConnectionFn ?? invokeConnection
        const execution = await invoker({
          connectionId: options.connectionId,
          organizationId: options.organizationId,
          subpath,
          method,
          queryParams,
          body,
          timeoutMs,
        })
        const durationMs = Date.now() - startTime

        // 404 or NOT_FOUND fallback handling
        const isNotFound =
          execution.status === 404 ||
          (typeof execution.error === "string" &&
            execution.error.toLowerCase().includes("not found")) ||
          (execution.data &&
            typeof execution.data === "object" &&
            (execution.data as Record<string, unknown>).error === "NOT_FOUND")

        if (isNotFound) {
          const notFoundResponse = {
            success: false,
            status: 404,
            code: "NOT_FOUND",
            message:
              "Data tidak ditemukan. Silakan periksa kembali parameter " +
              "yang diberikan atau hubungi customer service kami.",
            details: execution.data ?? execution.error,
          }

          await logToolExecutionAudit({
            organizationId: options.organizationId,
            sessionId: options.sessionId,
            toolName: options.connectionName,
            input,
            output: notFoundResponse,
            durationMs,
            status: "NOT_FOUND",
          })

          return notFoundResponse
        }

        if (!execution.success) {
          const isSsrf =
            execution.error?.includes("SSRF") ||
            execution.error?.includes("blocked host")
          const errorResponse = {
            success: false,
            status: execution.status,
            code: isSsrf ? "SSRF_BLOCKED" : "API_ERROR",
            message: isSsrf
              ? "Akses ke host lokal/privat diblokir demi keamanan."
              : execution.error || "Gagal memanggil API eksternal.",
            error: execution.error,
          }

          await logToolExecutionAudit({
            organizationId: options.organizationId,
            sessionId: options.sessionId,
            toolName: options.connectionName,
            input,
            output: errorResponse,
            durationMs,
            status: "ERROR",
            errorMessage: execution.error,
          })

          return errorResponse
        }

        const successResponse = {
          success: true,
          status: execution.status,
          data: execution.data,
        }

        await logToolExecutionAudit({
          organizationId: options.organizationId,
          sessionId: options.sessionId,
          toolName: options.connectionName,
          input,
          output: successResponse,
          durationMs,
          status: "SUCCESS",
        })

        return successResponse
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : String(err)
        const errorResult = {
          success: false,
          code: "TOOL_EXECUTION_ERROR",
          message: "Terjadi kesalahan saat memproses eksekusi tool API.",
          error: errorMessage,
        }

        await logToolExecutionAudit({
          organizationId: options.organizationId,
          sessionId: options.sessionId,
          toolName: options.connectionName,
          input,
          output: errorResult,
          durationMs,
          status: "ERROR",
          errorMessage,
        })

        return errorResult
      }
    },
  })
}

export function sanitizeToolName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_")
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sanitized)) {
    return sanitized
  }
  return `tool_${sanitized}`
}

export interface BuildAgentToolsOptions {
  organizationId: string
  agentProfileId?: string | null
  sessionId?: string | null
  connections?: Array<{
    id: string
    name: string
    description?: string | null
    baseUrl?: string
    subpath?: string
    method?: string
    inputSchema?: z.ZodTypeAny
    isActive?: boolean
  }>
}

export async function buildAgentTools(
  options: BuildAgentToolsOptions
): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {}

  tools.queryKnowledgeBase = createQueryKnowledgeBaseTool({
    organizationId: options.organizationId,
    agentProfileId: options.agentProfileId,
    sessionId: options.sessionId,
  })

  let connectionsList = options.connections
  if (!connectionsList) {
    try {
      const dbConnections = await prisma.aiIntegrationConnection.findMany({
        where: {
          organizationId: options.organizationId,
          isActive: true,
        },
      })
      connectionsList = dbConnections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        baseUrl: c.baseUrl,
        isActive: c.isActive,
      }))
    } catch {
      connectionsList = []
    }
  }

  for (const conn of connectionsList) {
    if (conn.isActive === false) {
      continue
    }
    const toolName = sanitizeToolName(conn.name)
    tools[toolName] = createConnectionApiTool({
      organizationId: options.organizationId,
      connectionId: conn.id,
      connectionName: toolName,
      subpath: conn.subpath,
      method: conn.method,
      description:
        conn.description ??
        `Panggil API eksternal ${conn.name} untuk mengambil/memeriksa data`,
      inputSchema: conn.inputSchema,
      sessionId: options.sessionId ?? undefined,
    })
  }

  return tools
}
