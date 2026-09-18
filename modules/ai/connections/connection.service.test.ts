import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import type { AiIntegrationConnection } from "@prisma/client"

process.env.APP_SECRET = "test-secret-key-for-unit-testing-32b"

const mockCreate = mock()
const mockFindFirst = mock()
const mockFindMany = mock()
const mockUpdate = mock()
const mockDelete = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiIntegrationConnection: {
      create: mockCreate,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const {
  createConnection,
  deleteConnection,
  executeConnectionRequest,
  getConnection,
  isPrivateOrBlockedHost,
  listConnections,
  maskHeaderValue,
  maskHeaders,
  toAiIntegrationConnectionDTO,
  updateConnection,
} = await import("./connection.service")

describe("connection.service", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockCreate.mockClear()
    mockFindFirst.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("isPrivateOrBlockedHost", () => {
    it("blocks localhost and subdomains of localhost", () => {
      expect(isPrivateOrBlockedHost("http://localhost")).toBe(true)
      expect(isPrivateOrBlockedHost("https://localhost:8080/api")).toBe(true)
      expect(isPrivateOrBlockedHost("http://sub.localhost")).toBe(true)
    })

    it("blocks IPv4 loopback 127.0.0.0/8", () => {
      expect(isPrivateOrBlockedHost("http://127.0.0.1")).toBe(true)
      expect(isPrivateOrBlockedHost("http://127.0.0.2:3000")).toBe(true)
      expect(isPrivateOrBlockedHost("http://127.255.255.255")).toBe(true)
    })

    it("blocks IPv4 0.0.0.0/8", () => {
      expect(isPrivateOrBlockedHost("http://0.0.0.0")).toBe(true)
      expect(isPrivateOrBlockedHost("http://0.1.2.3")).toBe(true)
    })

    it("blocks private Class A 10.0.0.0/8", () => {
      expect(isPrivateOrBlockedHost("http://10.0.0.1")).toBe(true)
      expect(isPrivateOrBlockedHost("https://10.254.1.2/webhook")).toBe(true)
    })

    it("blocks private Class B 172.16.0.0 - 172.31.255.255", () => {
      expect(isPrivateOrBlockedHost("http://172.16.0.1")).toBe(true)
      expect(isPrivateOrBlockedHost("http://172.24.10.5")).toBe(true)
      expect(isPrivateOrBlockedHost("http://172.31.255.255")).toBe(true)
      expect(isPrivateOrBlockedHost("http://172.15.0.1")).toBe(false)
      expect(isPrivateOrBlockedHost("http://172.32.0.1")).toBe(false)
    })

    it("blocks private Class C 192.168.0.0/16", () => {
      expect(isPrivateOrBlockedHost("http://192.168.1.1")).toBe(true)
      expect(isPrivateOrBlockedHost("http://192.168.100.20")).toBe(true)
    })

    it("blocks link-local / metadata 169.254.0.0/16", () => {
      expect(
        isPrivateOrBlockedHost("http://169.254.169.254/latest/meta-data")
      ).toBe(true)
    })

    it("blocks IPv6 loopback, link-local, and unique-local", () => {
      expect(isPrivateOrBlockedHost("http://[::1]")).toBe(true)
      expect(isPrivateOrBlockedHost("http://[fe80::1]")).toBe(true)
      expect(isPrivateOrBlockedHost("http://[fc00::1]")).toBe(true)
      expect(isPrivateOrBlockedHost("http://[fd12::1]")).toBe(true)
    })

    it("blocks non-http/https protocols and invalid URLs", () => {
      expect(isPrivateOrBlockedHost("ftp://example.com")).toBe(true)
      expect(isPrivateOrBlockedHost("file:///etc/passwd")).toBe(true)
      expect(isPrivateOrBlockedHost("javascript:alert(1)")).toBe(true)
      expect(isPrivateOrBlockedHost("not-a-valid-url")).toBe(true)
      expect(isPrivateOrBlockedHost("")).toBe(true)
    })

    it("allows valid public URLs", () => {
      expect(isPrivateOrBlockedHost("https://api.openai.com/v1")).toBe(false)
      expect(isPrivateOrBlockedHost("https://api.github.com/repos")).toBe(false)
      expect(isPrivateOrBlockedHost("http://example.com/api")).toBe(false)
      expect(isPrivateOrBlockedHost("https://1.1.1.1/dns-query")).toBe(false)
    })
  })

  describe("maskHeaderValue and maskHeaders", () => {
    it("masks long Bearer tokens preserving the last 4 characters", () => {
      expect(maskHeaderValue("Bearer secret-token-4f9a")).toBe(
        "Bearer ****4f9a"
      )
    })

    it("masks short Bearer tokens as **** without leaking suffix", () => {
      expect(maskHeaderValue("Bearer 123")).toBe("****")
      expect(maskHeaderValue("Bearer ab")).toBe("****")
    })

    it("masks long raw tokens and keys", () => {
      expect(maskHeaderValue("sk-proj-123454f9a")).toBe("****4f9a")
    })

    it("masks short values completely as ****", () => {
      expect(maskHeaderValue("abc")).toBe("****")
      expect(maskHeaderValue("1234")).toBe("****")
      expect(maskHeaderValue("")).toBe("")
    })

    it("masks headers dictionary while preserving safe headers", () => {
      const headers = {
        Authorization: "Bearer secret-token-4f9a",
        "X-API-Key": "my-secret-key-4f9a",
        "Content-Type": "application/json",
        Accept: "application/json",
      }
      const masked = maskHeaders(headers)
      expect(masked.Authorization).toBe("Bearer ****4f9a")
      expect(masked["X-API-Key"]).toBe("****4f9a")
      expect(masked["Content-Type"]).toBe("application/json")
      expect(masked.Accept).toBe("application/json")
    })
  })

  describe("toAiIntegrationConnectionDTO", () => {
    it("maps entity to DTO and handles null encrypted headers", () => {
      const now = new Date("2026-09-19T06:00:00.000Z")
      const entity: AiIntegrationConnection = {
        id: "conn_dto_1",
        organizationId: "org_dto",
        name: "Test DTO",
        description: null,
        baseUrl: "https://example.com",
        authType: "NONE",
        isActive: true,
        encryptedHeadersJson: null,
        createdAt: now,
        updatedAt: now,
      }
      const dto = toAiIntegrationConnectionDTO(entity)
      expect(dto.id).toBe("conn_dto_1")
      expect(dto.headers).toBeUndefined()
      expect(dto.createdAt).toBe(now.toISOString())
      expect(dto.updatedAt).toBe(now.toISOString())
    })
  })

  describe("createConnection", () => {
    it("creates connection, encrypts headers, and returns DTO", async () => {
      const now = new Date("2026-09-19T06:00:00.000Z")
      const mockSavedRecord: AiIntegrationConnection = {
        id: "conn_1",
        organizationId: "org_1",
        name: "OpenAI Main",
        description: "Primary LLM provider",
        baseUrl: "https://api.openai.com/v1",
        authType: "BEARER",
        isActive: true,
        encryptedHeadersJson: null,
        createdAt: now,
        updatedAt: now,
      }

      mockCreate.mockImplementation(async (args) => {
        return {
          ...mockSavedRecord,
          encryptedHeadersJson: args.data.encryptedHeadersJson,
        }
      })

      const result = await createConnection({
        organizationId: "org_1",
        name: "OpenAI Main",
        description: "Primary LLM provider",
        baseUrl: "https://api.openai.com/v1",
        authType: "BEARER",
        headers: {
          Authorization: "Bearer sk-proj-123456784f9a",
          "Content-Type": "application/json",
        },
      })

      expect(mockCreate).toHaveBeenCalledTimes(1)
      const callData = mockCreate.mock.calls[0]?.[0]?.data
      expect(callData.encryptedHeadersJson).toBeTruthy()
      expect(callData.encryptedHeadersJson).not.toContain(
        "sk-proj-123456784f9a"
      )

      expect(result.id).toBe("conn_1")
      expect(result.name).toBe("OpenAI Main")
      expect(result.headers?.Authorization).toBe("Bearer ****4f9a")
      expect(result.headers?.["Content-Type"]).toBe("application/json")
      expect(result.createdAt).toBe(now.toISOString())
    })

    it("throws error when baseUrl is a private or blocked host", async () => {
      await expect(
        createConnection({
          organizationId: "org_1",
          name: "Malicious Internal",
          baseUrl: "http://127.0.0.1:8080",
        })
      ).rejects.toThrow("Base URL targets a private or blocked host")
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe("getConnection", () => {
    it("returns null if connection is not found", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await getConnection("nonexistent", "org_1")
      expect(result).toBeNull()
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: "nonexistent", organizationId: "org_1" },
      })
    })

    it("returns connection DTO with masked headers when found", async () => {
      const now = new Date()
      // Create encrypted header by calling createConnection
      let encryptedPayload: string | null = null
      mockCreate.mockImplementation(async (args) => {
        encryptedPayload = args.data.encryptedHeadersJson
        return {
          id: "conn_2",
          organizationId: "org_1",
          name: "Custom Webhook",
          description: null,
          baseUrl: "https://api.example.com",
          authType: "API_KEY",
          isActive: true,
          encryptedHeadersJson: encryptedPayload,
          createdAt: now,
          updatedAt: now,
        }
      })

      await createConnection({
        organizationId: "org_1",
        name: "Custom Webhook",
        baseUrl: "https://api.example.com",
        headers: { "X-API-Key": "my-secret-key-4f9a" },
      })

      mockFindFirst.mockResolvedValue({
        id: "conn_2",
        organizationId: "org_1",
        name: "Custom Webhook",
        description: null,
        baseUrl: "https://api.example.com",
        authType: "API_KEY",
        isActive: true,
        encryptedHeadersJson: encryptedPayload,
        createdAt: now,
        updatedAt: now,
      })

      const result = await getConnection("conn_2", "org_1")
      expect(result).not.toBeNull()
      expect(result?.headers?.["X-API-Key"]).toBe("****4f9a")
    })
  })

  describe("listConnections", () => {
    it("returns a list of mapped and masked DTOs", async () => {
      const now = new Date()
      mockFindMany.mockResolvedValue([
        {
          id: "conn_1",
          organizationId: "org_1",
          name: "Conn 1",
          description: null,
          baseUrl: "https://api.one.com",
          authType: "NONE",
          isActive: true,
          encryptedHeadersJson: null,
          createdAt: now,
          updatedAt: now,
        },
      ])

      const list = await listConnections("org_1")
      expect(list).toHaveLength(1)
      expect(list[0]?.id).toBe("conn_1")
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { organizationId: "org_1" },
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("updateConnection", () => {
    it("throws error when connection is not found", async () => {
      mockFindFirst.mockResolvedValue(null)

      await expect(
        updateConnection("conn_missing", "org_1", { name: "New Name" })
      ).rejects.toThrow("Connection not found")
    })

    it("throws error when updated baseUrl is a blocked host", async () => {
      mockFindFirst.mockResolvedValue({
        id: "conn_1",
        organizationId: "org_1",
        name: "Old Name",
        baseUrl: "https://valid.com",
        encryptedHeadersJson: null,
      })

      await expect(
        updateConnection("conn_1", "org_1", { baseUrl: "http://192.168.1.1" })
      ).rejects.toThrow("Base URL targets a private or blocked host")
    })

    it("updates connection and re-encrypts headers", async () => {
      const now = new Date()
      mockFindFirst.mockResolvedValue({
        id: "conn_1",
        organizationId: "org_1",
        name: "Old Name",
        description: null,
        baseUrl: "https://api.service.com",
        authType: "NONE",
        isActive: true,
        encryptedHeadersJson: null,
        createdAt: now,
        updatedAt: now,
      })

      mockUpdate.mockImplementation(async (args) => ({
        id: "conn_1",
        organizationId: "org_1",
        name: args.data.name ?? "Old Name",
        description: null,
        baseUrl: "https://api.service.com",
        authType: "BEARER",
        isActive: true,
        encryptedHeadersJson: args.data.encryptedHeadersJson,
        createdAt: now,
        updatedAt: now,
      }))

      const result = await updateConnection("conn_1", "org_1", {
        authType: "BEARER",
        headers: { Authorization: "Bearer new-secret-token-4f9a" },
      })

      expect(result.authType).toBe("BEARER")
      expect(result.headers?.Authorization).toBe("Bearer ****4f9a")
    })
  })

  describe("deleteConnection", () => {
    it("returns false if connection does not exist", async () => {
      mockFindFirst.mockResolvedValue(null)
      const res = await deleteConnection("nonexistent", "org_1")
      expect(res).toBe(false)
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it("deletes existing connection and returns true", async () => {
      mockFindFirst.mockResolvedValue({ id: "conn_1", organizationId: "org_1" })
      mockDelete.mockResolvedValue({ id: "conn_1" })

      const res = await deleteConnection("conn_1", "org_1")
      expect(res).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "conn_1" } })
    })
  })

  describe("executeConnectionRequest", () => {
    it("returns 404 error if connection does not exist", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await executeConnectionRequest({
        connectionId: "conn_404",
        organizationId: "org_1",
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(result.error).toBe("Connection not found")
    })

    it("returns 403 error if connection is inactive", async () => {
      mockFindFirst.mockResolvedValue({
        id: "conn_inactive",
        organizationId: "org_1",
        isActive: false,
      })

      const result = await executeConnectionRequest({
        connectionId: "conn_inactive",
        organizationId: "org_1",
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(403)
      expect(result.error).toBe("Connection is inactive")
    })

    it("blocks SSRF if path resolves to private or blocked host", async () => {
      mockFindFirst.mockResolvedValue({
        id: "conn_1",
        organizationId: "org_1",
        baseUrl: "https://api.example.com",
        isActive: true,
        encryptedHeadersJson: null,
      })

      const result = await executeConnectionRequest({
        connectionId: "conn_1",
        organizationId: "org_1",
        path: "http://169.254.169.254/latest/meta-data",
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain("SSRF blocked")
    })

    it("executes HTTP request with decrypted headers and JSON", async () => {
      const now = new Date()
      let encryptedPayload: string | null = null
      mockCreate.mockImplementation(async (args) => {
        encryptedPayload = args.data.encryptedHeadersJson
        return {
          id: "conn_exec",
          organizationId: "org_1",
          baseUrl: "https://api.example.com",
          authType: "BEARER",
          isActive: true,
          encryptedHeadersJson: encryptedPayload,
          createdAt: now,
          updatedAt: now,
        }
      })

      await createConnection({
        organizationId: "org_1",
        name: "Exec Conn",
        baseUrl: "https://api.example.com",
        headers: { Authorization: "Bearer my-secret-token-12345" },
      })

      mockFindFirst.mockResolvedValue({
        id: "conn_exec",
        organizationId: "org_1",
        baseUrl: "https://api.example.com",
        authType: "BEARER",
        isActive: true,
        encryptedHeadersJson: encryptedPayload,
        createdAt: now,
        updatedAt: now,
      })

      let capturedUrl = ""
      let capturedHeaders: Record<string, string> = {}
      let capturedMethod = ""

      globalThis.fetch = mock(
        async (url: string | URL | Request, init?: RequestInit) => {
          capturedUrl = url.toString()
          capturedMethod = init?.method ?? "GET"
          capturedHeaders = (init?.headers as Record<string, string>) ?? {}

          return new Response(JSON.stringify({ message: "hello world" }), {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
          })
        }
      ) as unknown as typeof fetch

      const result = await executeConnectionRequest({
        connectionId: "conn_exec",
        organizationId: "org_1",
        path: "/v1/test",
        queryParams: { page: 2 },
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual({ message: "hello world" })
      expect(capturedUrl).toBe("https://api.example.com/v1/test?page=2")
      expect(capturedMethod).toBe("GET")
      expect(capturedHeaders.Authorization).toBe("Bearer my-secret-token-12345")
    })

    it("attaches Content-Type json for object body in POST", async () => {
      mockFindFirst.mockResolvedValue({
        id: "conn_post",
        organizationId: "org_1",
        baseUrl: "https://api.example.com",
        authType: "NONE",
        isActive: true,
        encryptedHeadersJson: null,
      })

      let capturedBody: unknown
      let capturedHeaders: Record<string, string> = {}

      globalThis.fetch = mock(async (_url, init) => {
        capturedBody = init?.body
        capturedHeaders = (init?.headers as Record<string, string>) ?? {}
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      }) as unknown as typeof fetch

      const result = await executeConnectionRequest({
        connectionId: "conn_post",
        organizationId: "org_1",
        method: "POST",
        path: "/create",
        body: { key: "value" },
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(201)
      expect(capturedBody).toBe(JSON.stringify({ key: "value" }))
      expect(capturedHeaders["Content-Type"]).toBe("application/json")
    })

    it("sanitizes leaked secrets if fetch throws an error", async () => {
      const secretToken = "super-secret-token-xyz-12345"
      const now = new Date()
      let encryptedPayload: string | null = null

      mockCreate.mockImplementation(async (args) => {
        encryptedPayload = args.data.encryptedHeadersJson
        return {
          id: "conn_err",
          organizationId: "org_1",
          baseUrl: "https://api.example.com",
          authType: "BEARER",
          isActive: true,
          encryptedHeadersJson: encryptedPayload,
          createdAt: now,
          updatedAt: now,
        }
      })

      await createConnection({
        organizationId: "org_1",
        name: "Error Conn",
        baseUrl: "https://api.example.com",
        headers: { Authorization: `Bearer ${secretToken}` },
      })

      mockFindFirst.mockResolvedValue({
        id: "conn_err",
        organizationId: "org_1",
        baseUrl: "https://api.example.com",
        authType: "BEARER",
        isActive: true,
        encryptedHeadersJson: encryptedPayload,
        createdAt: now,
        updatedAt: now,
      })

      globalThis.fetch = mock(async () => {
        throw new Error(`Connection failed with token: ${secretToken}`)
      }) as unknown as typeof fetch

      const result = await executeConnectionRequest({
        connectionId: "conn_err",
        organizationId: "org_1",
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(0)
      expect(result.error).not.toContain(secretToken)
      expect(result.error).toContain("[REDACTED]")
    })

    it("sanitizes secrets when server responds non-ok with body", async () => {
      const secretToken = "sensitive-api-token-98765"
      const now = new Date()
      let encryptedPayload: string | null = null

      mockCreate.mockImplementation(async (args) => {
        encryptedPayload = args.data.encryptedHeadersJson
        return {
          id: "conn_err_body",
          organizationId: "org_1",
          baseUrl: "https://api.example.com",
          authType: "BEARER",
          isActive: true,
          encryptedHeadersJson: encryptedPayload,
          createdAt: now,
          updatedAt: now,
        }
      })

      await createConnection({
        organizationId: "org_1",
        name: "Error Body Conn",
        baseUrl: "https://api.example.com",
        headers: { "X-API-Key": secretToken },
      })

      mockFindFirst.mockResolvedValue({
        id: "conn_err_body",
        organizationId: "org_1",
        baseUrl: "https://api.example.com",
        authType: "BEARER",
        isActive: true,
        encryptedHeadersJson: encryptedPayload,
        createdAt: now,
        updatedAt: now,
      })

      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({ error: `Unauthorized key: ${secretToken}` }),
          {
            status: 401,
            statusText: "Unauthorized",
            headers: { "Content-Type": "application/json" },
          }
        )
      }) as unknown as typeof fetch

      const result = await executeConnectionRequest({
        connectionId: "conn_err_body",
        organizationId: "org_1",
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(401)
      expect(result.error).not.toContain(secretToken)
      expect(result.error).toContain("[REDACTED]")
    })
  })
})
