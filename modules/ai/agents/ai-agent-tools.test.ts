import { beforeEach, describe, expect, it, mock } from "bun:test"
import { z } from "zod"

type ExecutableTool = { execute: (args: unknown) => Promise<unknown> }

const mockSearchHybridKnowledge = mock()
const mockInvokeConnection = mock()
const mockAiUsageAuditCreate = mock()
const mockAiIntegrationConnectionFindMany = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiUsageAudit: {
      create: mockAiUsageAuditCreate,
    },
    aiIntegrationConnection: {
      findMany: mockAiIntegrationConnectionFindMany,
    },
  },
}))

mock.module("@/modules/ai/ai-rag.service", () => ({
  searchHybridKnowledge: mockSearchHybridKnowledge,
}))

mock.module("@/modules/ai/connections/connection.service", () => ({
  invokeConnection: mockInvokeConnection,
}))

const {
  createQueryKnowledgeBaseTool,
  createConnectionApiTool,
  buildAgentTools,
  logToolExecutionAudit,
  sanitizeToolName,
} = await import("./ai-agent-tools")

describe("modules/ai/agents/ai-agent-tools", () => {
  beforeEach(() => {
    mockSearchHybridKnowledge.mockClear()
    mockInvokeConnection.mockClear()
    mockAiUsageAuditCreate.mockClear()
    mockAiIntegrationConnectionFindMany.mockClear()

    mockSearchHybridKnowledge.mockResolvedValue([
      {
        id: "chunk_1",
        title: "Jam Operasional",
        category: "INFO",
        contentMarkdown: "Buka dari 08:00 hingga 17:00 WIB.",
        rrfScore: 0.98,
      },
    ])

    mockInvokeConnection.mockResolvedValue({
      success: true,
      status: 200,
      data: { status: "COMPLETED", registrationNumber: "LAB-12345" },
    })

    mockAiUsageAuditCreate.mockResolvedValue({ id: "audit_1" })
    mockAiIntegrationConnectionFindMany.mockResolvedValue([])
  })

  describe("sanitizeToolName", () => {
    it("sanitizes invalid characters to underscores", () => {
      expect(sanitizeToolName("product-api.v1")).toBe("product_api_v1")
      expect(sanitizeToolName("check lab status")).toBe("check_lab_status")
      expect(sanitizeToolName("123tool")).toBe("tool_123tool")
    })
  })

  describe("createQueryKnowledgeBaseTool", () => {
    it("executes hybrid search and returns formatted documents", async () => {
      const kbTool = createQueryKnowledgeBaseTool({
        organizationId: "org_1",
        agentProfileId: "agent_1",
        sessionId: "sess_1",
      })

      const toolObj = kbTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        query: "jam operasional",
        limit: 3,
      })) as {
        success: boolean
        count: number
        documents: Array<{ id: string; title: string }>
      }

      expect(mockSearchHybridKnowledge).toHaveBeenCalledWith({
        organizationId: "org_1",
        agentProfileId: "agent_1",
        query: "jam operasional",
        limit: 3,
      })
      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(result.documents[0]?.title).toBe("Jam Operasional")
      expect(mockAiUsageAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: "org_1",
            agentProfileId: "agent_1",
            toolName: "queryKnowledgeBase",
            status: "SUCCESS",
          }),
        })
      )
    })

    it("returns NOT_FOUND fallback when no documents match", async () => {
      mockSearchHybridKnowledge.mockResolvedValueOnce([])

      const kbTool = createQueryKnowledgeBaseTool({
        organizationId: "org_1",
      })

      const toolObj = kbTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        query: "rahasia negara",
      })) as {
        success: boolean
        count: number
        message: string
      }

      expect(result.success).toBe(true)
      expect(result.count).toBe(0)
      expect(result.message).toContain("Tidak ditemukan dokumen")
      expect(mockAiUsageAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "NOT_FOUND",
          }),
        })
      )
    })

    it("handles search error gracefully and records audit log", async () => {
      mockSearchHybridKnowledge.mockRejectedValueOnce(
        new Error("Database connection lost")
      )

      const kbTool = createQueryKnowledgeBaseTool({
        organizationId: "org_1",
      })

      const toolObj = kbTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        query: "error test",
      })) as {
        success: boolean
        error: string
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe("KNOWLEDGE_SEARCH_ERROR")
      expect(mockAiUsageAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ERROR",
            errorMessage: "Database connection lost",
          }),
        })
      )
    })
  })

  describe("createConnectionApiTool", () => {
    it("invokes connection API with parameters and returns data", async () => {
      const checkLabTool = createConnectionApiTool({
        organizationId: "org_1",
        connectionId: "conn_lab_1",
        connectionName: "checkLabStatus",
        subpath: "/lab/results",
        method: "GET",
        inputSchema: z.object({
          registrationNumber: z.string(),
        }),
        invokeConnectionFn: mockInvokeConnection,
      })

      const toolObj = checkLabTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        registrationNumber: "REG-999",
      })) as {
        success: boolean
        data: { status: string }
      }

      expect(mockInvokeConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: "conn_lab_1",
          organizationId: "org_1",
          subpath: "/lab/results",
          method: "GET",
          queryParams: { registrationNumber: "REG-999" },
          timeoutMs: 8000,
        })
      )
      expect(result.success).toBe(true)
      expect(result.data.status).toBe("COMPLETED")
      expect(mockAiUsageAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolName: "checkLabStatus",
            status: "SUCCESS",
          }),
        })
      )
    })

    it("returns formatted 404 / NOT_FOUND fallback on missing", async () => {
      mockInvokeConnection.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Registration number not found",
      })

      const checkLabTool = createConnectionApiTool({
        organizationId: "org_1",
        connectionId: "conn_lab_1",
        connectionName: "checkLabStatus",
        invokeConnectionFn: mockInvokeConnection,
      })

      const toolObj = checkLabTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        registrationNumber: "INVALID-NO",
      })) as {
        success: boolean
        status: number
        code: string
        message: string
      }

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(result.code).toBe("NOT_FOUND")
      expect(result.message).toContain("Data tidak ditemukan")
      expect(mockAiUsageAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "NOT_FOUND",
          }),
        })
      )
    })

    it("blocks SSRF targets and returns SSRF_BLOCKED code", async () => {
      mockInvokeConnection.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "SSRF blocked: URL targets a private or blocked host",
      })

      const apiTool = createConnectionApiTool({
        organizationId: "org_1",
        connectionId: "conn_ssrf",
        connectionName: "invokeProductApi",
        invokeConnectionFn: mockInvokeConnection,
      })

      const toolObj = apiTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        subpath: "http://127.0.0.1:8080",
      })) as {
        success: boolean
        code: string
      }

      expect(result.success).toBe(false)
      expect(result.code).toBe("SSRF_BLOCKED")
      expect(mockAiUsageAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ERROR",
          }),
        })
      )
    })

    it("handles connection exceptions gracefully", async () => {
      mockInvokeConnection.mockRejectedValueOnce(
        new Error("Network timeout after 8000ms")
      )

      const apiTool = createConnectionApiTool({
        organizationId: "org_1",
        connectionId: "conn_timeout",
        connectionName: "invokeProductApi",
        invokeConnectionFn: mockInvokeConnection,
      })

      const toolObj = apiTool as unknown as ExecutableTool
      const result = (await toolObj.execute({
        sku: "SHOES-01",
      })) as {
        success: boolean
        code: string
        error: string
      }

      expect(result.success).toBe(false)
      expect(result.code).toBe("TOOL_EXECUTION_ERROR")
      expect(result.error).toContain("timeout")
    })
  })

  describe("buildAgentTools", () => {
    it("returns knowledge base tool and active connections", async () => {
      mockAiIntegrationConnectionFindMany.mockResolvedValueOnce([
        {
          id: "conn_1",
          name: "invokeProductApi",
          description: "Cek stok produk",
          baseUrl: "https://api.example.com",
          isActive: true,
        },
        {
          id: "conn_2",
          name: "inactive_tool",
          baseUrl: "https://api.example.com",
          isActive: false,
        },
      ])

      const tools = await buildAgentTools({
        organizationId: "org_1",
        agentProfileId: "agent_1",
      })

      expect(tools.queryKnowledgeBase).toBeDefined()
      expect(tools.invokeProductApi).toBeDefined()
      expect(tools.inactive_tool).toBeUndefined()
    })

    it("binds explicit connections if passed in params", async () => {
      const tools = await buildAgentTools({
        organizationId: "org_1",
        connections: [
          {
            id: "conn_custom",
            name: "checkLabStatus",
            subpath: "/lab/status",
            method: "GET",
          },
        ],
      })

      expect(tools.queryKnowledgeBase).toBeDefined()
      expect(tools.checkLabStatus).toBeDefined()
      expect(mockAiIntegrationConnectionFindMany).not.toHaveBeenCalled()
    })
  })

  describe("logToolExecutionAudit", () => {
    it("swallows errors gracefully when table is unavailable", async () => {
      mockAiUsageAuditCreate.mockRejectedValueOnce(
        new Error("relation 'aiUsageAudit' does not exist")
      )

      expect(async () => {
        await logToolExecutionAudit({
          toolName: "testTool",
          input: { a: 1 },
          output: { b: 2 },
          durationMs: 12,
          status: "SUCCESS",
        })
      }).not.toThrow()
    })
  })
})
