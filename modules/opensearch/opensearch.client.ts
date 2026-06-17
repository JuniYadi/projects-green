/**
 * OpenSearch client for projects-green
 * Supports multi-region configuration via env vars or database config
 * Migrated from Laravel OpenSearchClient.php
 */

import type {
  OpenSearchConfig,
  OpenSearchRegionConfig,
  OpenSearchHealthCheck,
  OpenSearchConnectionTest,
} from "./opensearch.types"

// ─── Config Resolution ────────────────────────────────────────────────────────

/**
 * Build OpenSearch config for a specific region.
 * Resolution order: env vars → database config (stubbed) → defaults
 */
export function buildOpenSearchConfig(regionCode: string): OpenSearchRegionConfig {
  const prefix = `OPENSEARCH_${regionCode.toUpperCase().replace(/-/g, "_")}`

  const envConfig = getEnvironmentConfig(prefix)

  // TODO: Add database config resolution (Server custom fields)
  if (envConfig.host) {
    return { ...envConfig, regionCode }
  }

  return {
    ...getDefaultConfig(),
    regionCode,
  }
}

function getEnvironmentConfig(prefix: string): OpenSearchConfig {
  return {
    host: process.env[`${prefix}_ENDPOINT`] ?? process.env["OPENSEARCH_HOST"] ?? "localhost:9200",
    username: process.env[`${prefix}_USERNAME`] ?? process.env["OPENSEARCH_USERNAME"] ?? "admin",
    password: process.env[`${prefix}_PASSWORD`] ?? process.env["OPENSEARCH_PASSWORD"] ?? "admin",
    apiKey: process.env[`${prefix}_API_KEY`] ?? process.env["OPENSEARCH_API_KEY"],
    sslVerify: process.env[`${prefix}_VERIFY_SSL`] !== "false",
    timeout: parseInt(process.env[`${prefix}_TIMEOUT`] ?? "30", 10),
  }
}

function getDefaultConfig(): OpenSearchConfig {
  return {
    host: process.env["OPENSEARCH_HOST"] ?? "https://localhost:9200",
    username: process.env["OPENSEARCH_USERNAME"] ?? "admin",
    password: process.env["OPENSEARCH_PASSWORD"] ?? "admin",
    apiKey: process.env["OPENSEARCH_API_KEY"],
    sslVerify: process.env["OPENSEARCH_VERIFY_SSL"] !== "false",
    timeout: parseInt(process.env["OPENSEARCH_TIMEOUT"] ?? "30", 10),
  }
}

// ─── HTTP Client Factory ──────────────────────────────────────────────────────

function getAuthHeaders(config: OpenSearchConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  if (config.apiKey) {
    headers["Authorization"] = `ApiKey ${config.apiKey}`
  } else if (config.username && config.password) {
    const creds = Buffer.from(`${config.username}:${config.password}`).toString("base64")
    headers["Authorization"] = `Basic ${creds}`
  }

  return headers
}

function buildUrl(host: string): string {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return host
  }
  return host.startsWith(":9200") ? `http://localhost${host}` : `https://${host}`
}

// ─── OpenSearch Client Class ──────────────────────────────────────────────────

export class OpenSearchClient {
  private config: OpenSearchConfig
  private baseUrl: string
  private authHeaders: Record<string, string>

  constructor(config: OpenSearchConfig) {
    this.config = config
    this.baseUrl = buildUrl(config.host)
    this.authHeaders = getAuthHeaders(config)
  }

  static forRegion(regionCode: string): OpenSearchClient {
    return new OpenSearchClient(buildOpenSearchConfig(regionCode))
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const options: RequestInit = {
      method,
      headers: this.authHeaders,
    }

    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenSearch ${method} ${path} failed: ${response.status} - ${text}`)
    }

    return response.json() as Promise<T>
  }

  async testConnection(): Promise<OpenSearchConnectionTest> {
    try {
      const info = await this.request<Record<string, unknown>>("GET", "/")
      return {
        success: true,
        info,
        message: "Connected successfully",
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Connection failed",
      }
    }
  }

  async healthCheck(): Promise<OpenSearchHealthCheck> {
    try {
      const health = await this.request<{
        status: string
        cluster_name: string
        number_of_nodes: number
      }>("GET", "/_cluster/health")

      return {
        success: true,
        status: health.status,
        clusterName: health.cluster_name,
        numberOfNodes: health.number_of_nodes,
        message: "OpenSearch cluster is healthy",
      }
    } catch (error) {
      return {
        success: false,
        status: "unknown",
        clusterName: "unknown",
        numberOfNodes: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "OpenSearch health check failed",
      }
    }
  }

  async search(
    index: string,
    query: Record<string, unknown> = {},
    size = 100,
    from = 0
  ): Promise<{ hits: { total: { value: number }; hits: Array<{ _id: string; _source: Record<string, unknown> }> }; took: number }> {
    const body = {
      size,
      from,
      query: Object.keys(query).length > 0 ? query : { match_all: {} },
      sort: [{ "@timestamp": { order: "desc" } }],
    }

    return this.request("POST", `/${index}/_search`, body)
  }

  async multiIndexSearch(
    indices: string[],
    query: Record<string, unknown> = {},
    size = 100,
    from = 0
  ): Promise<{ hits: { total: { value: number }; hits: Array<{ _id: string; _source: Record<string, unknown> }> }; took: number }> {
    const indexList = indices.join(",")
    return this.search(indexList, query, size, from)
  }

  async getIndices(): Promise<string[]> {
    try {
      const result = await this.request<
        Array<{ index: string }>
      >("GET", "/_cat/indices?format=json")
      return result.map((r) => r.index)
    } catch {
      return []
    }
  }

  async getIndicesByPattern(pattern: string): Promise<string[]> {
    const all = await this.getIndices()
    return all.filter((index) => {
      // Simple fnmatch-style pattern matching
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      )
      return regex.test(index)
    })
  }

  async getMapping(indexPattern: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/${indexPattern}/_mapping`)
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.request("GET", "/_cluster/health")
      return true
    } catch {
      return false
    }
  }
}

// ─── Region-aware Client Factory ─────────────────────────────────────────────

export class OpenSearchRegionClient extends OpenSearchClient {
  constructor(private regionCode: string) {
    super(buildOpenSearchConfig(regionCode))
  }

  switchRegion(regionCode: string): OpenSearchRegionClient {
    return new OpenSearchRegionClient(regionCode)
  }

  getCurrentRegion(): string {
    return this.regionCode
  }
}