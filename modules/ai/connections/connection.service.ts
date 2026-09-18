import type { AiIntegrationConnection } from "@prisma/client"

import {
  decrypt,
  encrypt,
  getEncryptionKey,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"
import { prisma } from "@/lib/prisma"

export interface CreateConnectionParams {
  organizationId: string
  name: string
  description?: string | null
  baseUrl: string
  authType?: string
  headers?: Record<string, string>
  isActive?: boolean
}

export interface UpdateConnectionParams {
  name?: string
  description?: string | null
  baseUrl?: string
  authType?: string
  headers?: Record<string, string>
  isActive?: boolean
}

export interface ExecuteConnectionRequestParams {
  connectionId: string
  organizationId: string
  path?: string
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  queryParams?: Record<string, string | number | boolean>
  body?: unknown
  timeoutMs?: number
}

export interface ConnectionExecutionResult<T = unknown> {
  success: boolean
  status: number
  statusText?: string
  data?: T
  headers?: Record<string, string>
  error?: string
}

export interface AiIntegrationConnectionDTO {
  id: string
  organizationId: string
  name: string
  description: string | null
  baseUrl: string
  authType: string
  isActive: boolean
  headers?: Record<string, string>
  createdAt: string
  updatedAt: string
}

const NON_SENSITIVE_HEADERS = new Set([
  "accept",
  "accept-charset",
  "accept-encoding",
  "accept-language",
  "cache-control",
  "content-type",
  "user-agent",
])

export function maskHeaderValue(value: string): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (trimmed.length <= 4) {
    return "****"
  }
  if (/^bearer\s+/i.test(trimmed)) {
    const token = trimmed.replace(/^bearer\s+/i, "").trim()
    if (token.length <= 4) {
      return "****"
    }
    return `Bearer ****${token.slice(-4)}`
  }
  if (/^basic\s+/i.test(trimmed)) {
    const token = trimmed.replace(/^basic\s+/i, "").trim()
    if (token.length <= 4) {
      return "****"
    }
    return `Basic ****${token.slice(-4)}`
  }
  return `****${trimmed.slice(-4)}`
}

export function maskHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(headers)) {
    if (
      NON_SENSITIVE_HEADERS.has(key.toLowerCase()) &&
      !/^bearer\s+/i.test(val) &&
      !/^basic\s+/i.test(val)
    ) {
      result[key] = val
    } else {
      result[key] = maskHeaderValue(val)
    }
  }
  return result
}

function encryptHeaders(headers: Record<string, string>): string {
  const key = getEncryptionKey()
  const payload = JSON.stringify(headers)
  const encrypted = encrypt(payload, key)
  return serializeEncryptedField(encrypted)
}

function decryptHeaders(
  encryptedHeadersJson: string | null
): Record<string, string> | null {
  if (!encryptedHeadersJson) return null
  try {
    const key = getEncryptionKey()
    const parsed = parseEncryptedField(encryptedHeadersJson)
    if (!parsed) return null
    const decrypted = decrypt(parsed, key)
    return JSON.parse(decrypted) as Record<string, string>
  } catch {
    return null
  }
}

export function isPrivateOrBlockedHost(url: string): boolean {
  if (!url || typeof url !== "string") return true

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return true
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true
  }

  let hostname = parsed.hostname.toLowerCase().trim()
  if (!hostname) return true

  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1)
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "::1"
  ) {
    return true
  }

  if (hostname.startsWith("::ffff:")) {
    hostname = hostname.slice(7)
  }

  if (
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd")
  ) {
    return true
  }

  if (hostname.startsWith("127.")) return true
  if (hostname.startsWith("0.")) return true
  if (hostname.startsWith("10.")) return true
  if (hostname.startsWith("169.254.")) return true
  if (hostname.startsWith("192.168.")) return true

  const match172 = hostname.match(/^172\.(\d+)\./)
  if (match172) {
    const secondOctet = Number.parseInt(match172[1] ?? "", 10)
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true
    }
  }

  return false
}

export function toAiIntegrationConnectionDTO(
  connection: AiIntegrationConnection
): AiIntegrationConnectionDTO {
  let maskedHeaders: Record<string, string> | undefined
  if (connection.encryptedHeadersJson) {
    const rawHeaders = decryptHeaders(connection.encryptedHeadersJson)
    if (rawHeaders) {
      maskedHeaders = maskHeaders(rawHeaders)
    }
  }

  return {
    id: connection.id,
    organizationId: connection.organizationId,
    name: connection.name,
    description: connection.description,
    baseUrl: connection.baseUrl,
    authType: connection.authType,
    isActive: connection.isActive,
    headers: maskedHeaders,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  }
}

export async function createConnection(
  params: CreateConnectionParams
): Promise<AiIntegrationConnectionDTO> {
  if (isPrivateOrBlockedHost(params.baseUrl)) {
    throw new Error("Base URL targets a private or blocked host")
  }

  const encryptedHeadersJson = params.headers
    ? encryptHeaders(params.headers)
    : null

  const created = await prisma.aiIntegrationConnection.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      description: params.description ?? null,
      baseUrl: params.baseUrl,
      authType: params.authType ?? "NONE",
      isActive: params.isActive ?? true,
      encryptedHeadersJson,
    },
  })

  return toAiIntegrationConnectionDTO(created)
}

export async function getConnection(
  id: string,
  organizationId: string
): Promise<AiIntegrationConnectionDTO | null> {
  const connection = await prisma.aiIntegrationConnection.findFirst({
    where: { id, organizationId },
  })

  if (!connection) {
    return null
  }

  return toAiIntegrationConnectionDTO(connection)
}

export async function listConnections(
  organizationId: string
): Promise<AiIntegrationConnectionDTO[]> {
  const connections = await prisma.aiIntegrationConnection.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  })

  return connections.map(toAiIntegrationConnectionDTO)
}

export async function updateConnection(
  id: string,
  organizationId: string,
  params: UpdateConnectionParams
): Promise<AiIntegrationConnectionDTO> {
  const existing = await prisma.aiIntegrationConnection.findFirst({
    where: { id, organizationId },
  })

  if (!existing) {
    throw new Error("Connection not found")
  }

  if (params.baseUrl !== undefined && isPrivateOrBlockedHost(params.baseUrl)) {
    throw new Error("Base URL targets a private or blocked host")
  }

  let encryptedHeadersJson: string | null | undefined
  if (params.headers !== undefined) {
    encryptedHeadersJson = params.headers
      ? encryptHeaders(params.headers)
      : null
  }

  const updated = await prisma.aiIntegrationConnection.update({
    where: { id },
    data: {
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...(params.description !== undefined
        ? { description: params.description }
        : {}),
      ...(params.baseUrl !== undefined ? { baseUrl: params.baseUrl } : {}),
      ...(params.authType !== undefined ? { authType: params.authType } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(encryptedHeadersJson !== undefined ? { encryptedHeadersJson } : {}),
    },
  })

  return toAiIntegrationConnectionDTO(updated)
}

export async function deleteConnection(
  id: string,
  organizationId: string
): Promise<boolean> {
  const existing = await prisma.aiIntegrationConnection.findFirst({
    where: { id, organizationId },
  })

  if (!existing) {
    return false
  }

  await prisma.aiIntegrationConnection.delete({
    where: { id },
  })

  return true
}

function sanitizeErrorString(input: string, secrets: string[]): string {
  let sanitized = input
  for (const secret of secrets) {
    if (secret && secret.length >= 3) {
      sanitized = sanitized.split(secret).join("[REDACTED]")
    }
  }
  return sanitized
}

export async function executeConnectionRequest(
  params: ExecuteConnectionRequestParams
): Promise<ConnectionExecutionResult> {
  const connection = await prisma.aiIntegrationConnection.findFirst({
    where: {
      id: params.connectionId,
      organizationId: params.organizationId,
    },
  })

  if (!connection) {
    return {
      success: false,
      status: 404,
      error: "Connection not found",
    }
  }

  if (!connection.isActive) {
    return {
      success: false,
      status: 403,
      error: "Connection is inactive",
    }
  }

  const decryptedHeaders = connection.encryptedHeadersJson
    ? decryptHeaders(connection.encryptedHeadersJson) ?? {}
    : {}

  const secretTokens: string[] = []
  for (const val of Object.values(decryptedHeaders)) {
    if (val && typeof val === "string") {
      secretTokens.push(val)
      if (/^bearer\s+/i.test(val)) {
        secretTokens.push(val.replace(/^bearer\s+/i, "").trim())
      }
    }
  }

  if (params.headers) {
    for (const val of Object.values(params.headers)) {
      if (val && typeof val === "string") {
        secretTokens.push(val)
        if (/^bearer\s+/i.test(val)) {
          secretTokens.push(val.replace(/^bearer\s+/i, "").trim())
        }
      }
    }
  }

  const rawPath = params.path ?? params.endpoint ?? ""
  let targetUrl: URL
  try {
    const base = connection.baseUrl.endsWith("/")
      ? connection.baseUrl
      : `${connection.baseUrl}/`
    const normalizedPath = rawPath.replace(/^\//, "")
    targetUrl = new URL(normalizedPath, base)

    if (params.queryParams) {
      for (const [k, v] of Object.entries(params.queryParams)) {
        if (v !== undefined && v !== null) {
          targetUrl.searchParams.set(k, String(v))
        }
      }
    }
  } catch {
    return {
      success: false,
      status: 400,
      error: "Invalid request URL",
    }
  }

  if (isPrivateOrBlockedHost(targetUrl.toString())) {
    return {
      success: false,
      status: 400,
      error: "SSRF blocked: URL targets a private or blocked host",
    }
  }

  const outgoingHeaders: Record<string, string> = {
    ...decryptedHeaders,
    ...(params.headers ?? {}),
  }

  const method = (params.method ?? "GET").toUpperCase()
  let bodyPayload: BodyInit | undefined
  if (params.body !== undefined && method !== "GET" && method !== "HEAD") {
    if (typeof params.body === "string") {
      bodyPayload = params.body
    } else {
      bodyPayload = JSON.stringify(params.body)
      const hasContentType = Object.keys(outgoingHeaders).some(
        (k) => k.toLowerCase() === "content-type"
      )
      if (!hasContentType) {
        outgoingHeaders["Content-Type"] = "application/json"
      }
    }
  }

  const timeoutMs = params.timeoutMs ?? 30000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      headers: outgoingHeaders,
      body: bodyPayload,
      signal: controller.signal,
    })
    clearTimeout(timer)

    const respHeaders: Record<string, string> = {}
    response.headers.forEach((val, key) => {
      respHeaders[key] = val
    })

    const contentType = response.headers.get("content-type") ?? ""
    let data: unknown
    if (contentType.includes("application/json")) {
      try {
        data = await response.json()
      } catch {
        data = await response.text()
      }
    } else {
      const text = await response.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!response.ok) {
      const rawErr = typeof data === "string" ? data : JSON.stringify(data)
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: respHeaders,
        error: sanitizeErrorString(
          rawErr || `HTTP ${response.status} ${response.statusText}`,
          secretTokens
        ),
      }
    }

    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: respHeaders,
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const rawMessage = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      status: 0,
      error: sanitizeErrorString(rawMessage, secretTokens),
    }
  }
}
