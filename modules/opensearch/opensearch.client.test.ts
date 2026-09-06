import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import {
  OpenSearchClient,
  OpenSearchRegionClient,
  buildOpenSearchConfig,
} from "./opensearch.client"
import type { OpenSearchConfig } from "./opensearch.types"

const makeConfig = (
  overrides: Partial<OpenSearchConfig> = {}
): OpenSearchConfig => ({
  host: "http://localhost:9200",
  username: "admin",
  password: "admin",
  sslVerify: true,
  timeout: 30,
  ...overrides,
})

describe("OpenSearchClient", () => {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
  })

  describe("buildOpenSearchConfig", () => {
    it("reads region-specific environment variables", () => {
      process.env["OPENSEARCH_US_EAST_1_ENDPOINT"] =
        "https://useast.example.com:9200"
      process.env["OPENSEARCH_US_EAST_1_USERNAME"] = "custom_user"
      process.env["OPENSEARCH_US_EAST_1_PASSWORD"] = "custom_pass"
      process.env["OPENSEARCH_US_EAST_1_VERIFY_SSL"] = "false"
      process.env["OPENSEARCH_US_EAST_1_TIMEOUT"] = "45"

      const config = buildOpenSearchConfig("us-east-1")
      expect(config.regionCode).toBe("us-east-1")
      expect(config.host).toBe("https://useast.example.com:9200")
      expect(config.username).toBe("custom_user")
      expect(config.password).toBe("custom_pass")
      expect(config.sslVerify).toBe(false)
      expect(config.timeout).toBe(45)
    })

    it("falls back to default config when region env vars are absent", () => {
      delete process.env["OPENSEARCH_EU_WEST_1_ENDPOINT"]
      process.env["OPENSEARCH_HOST"] = "https://default.example.com"

      const config = buildOpenSearchConfig("eu-west-1")
      expect(config.regionCode).toBe("eu-west-1")
      expect(config.host).toBe("https://default.example.com")
    })
  })

  describe("Authentication and URL normalization", () => {
    it("uses ApiKey header when apiKey is configured", async () => {
      let capturedHeaders: Record<string, string> | undefined
      globalThis.fetch = mock(async (_url: unknown, options?: RequestInit) => {
        capturedHeaders = options?.headers as Record<string, string>
        return new Response(
          JSON.stringify({ tagline: "You Know, for Search" }),
          {
            status: 200,
          }
        )
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({
          host: "http://localhost:9200",
          apiKey: "secret-api-key-123",
        })
      )

      const res = await client.testConnection()
      expect(res.success).toBe(true)
      expect(capturedHeaders?.["Authorization"]).toBe(
        "ApiKey secret-api-key-123"
      )
    })

    it("uses Basic Auth when username and password are provided", async () => {
      let capturedHeaders: Record<string, string> | undefined
      globalThis.fetch = mock(async (_url: unknown, options?: RequestInit) => {
        capturedHeaders = options?.headers as Record<string, string>
        return new Response(JSON.stringify({ tagline: "OK" }), { status: 200 })
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({
          host: ":9200",
          username: "admin",
          password: "secretpassword",
        })
      )

      const res = await client.testConnection()
      expect(res.success).toBe(true)
      const expectedBasic = Buffer.from("admin:secretpassword").toString(
        "base64"
      )
      expect(capturedHeaders?.["Authorization"]).toBe(`Basic ${expectedBasic}`)
    })

    it("normalizes hostnames without protocol to https", async () => {
      let capturedUrl = ""
      globalThis.fetch = mock(async (url: unknown) => {
        capturedUrl = String(url)
        return new Response(JSON.stringify({ tagline: "OK" }), { status: 200 })
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({
          host: "cluster.internal:9200",
        })
      )

      await client.testConnection()
      expect(capturedUrl).toBe("https://cluster.internal:9200/")
    })
  })

  describe("API methods", () => {
    it("returns error info when testConnection fails", async () => {
      globalThis.fetch = mock(async () => {
        return new Response("Unauthorized", { status: 401 })
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({ host: "http://localhost:9200" })
      )
      const res = await client.testConnection()
      expect(res.success).toBe(false)
      expect(res.message).toBe("Connection failed")
      expect(res.error).toContain("401")
    })

    it("handles healthCheck success and failure", async () => {
      globalThis.fetch = mock(async (url: unknown) => {
        if (String(url).includes("_cluster/health")) {
          return new Response(
            JSON.stringify({
              status: "green",
              cluster_name: "prod-logs",
              number_of_nodes: 3,
            }),
            { status: 200 }
          )
        }
        return new Response("Not found", { status: 404 })
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({ host: "http://localhost:9200" })
      )
      const health = await client.healthCheck()
      expect(health.success).toBe(true)
      expect(health.status).toBe("green")
      expect(health.clusterName).toBe("prod-logs")
      expect(health.numberOfNodes).toBe(3)

      const available = await client.isAvailable()
      expect(available).toBe(true)

      // Failure path
      globalThis.fetch = mock(async () => {
        throw new Error("Network unreachable")
      }) as unknown as typeof fetch

      const failedHealth = await client.healthCheck()
      expect(failedHealth.success).toBe(false)
      expect(failedHealth.error).toBe("Network unreachable")

      const failedAvailable = await client.isAvailable()
      expect(failedAvailable).toBe(false)
    })

    it("performs search with default match_all query and custom params", async () => {
      let capturedBody: Record<string, unknown> | undefined
      let capturedUrl = ""

      globalThis.fetch = mock(async (url: unknown, options?: RequestInit) => {
        capturedUrl = String(url)
        capturedBody = JSON.parse(String(options?.body))
        return new Response(
          JSON.stringify({
            took: 5,
            hits: {
              total: { value: 1 },
              hits: [{ _id: "1", _source: { test: true } }],
            },
          }),
          { status: 200 }
        )
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({ host: "http://localhost:9200" })
      )
      const res = await client.search("app-logs-2026", {}, 50, 10)

      expect(capturedUrl).toContain("/app-logs-2026/_search")
      expect(capturedBody?.size).toBe(50)
      expect(capturedBody?.from).toBe(10)
      expect(capturedBody?.query).toEqual({ match_all: {} })
      expect(res.hits.total.value).toBe(1)
    })

    it("performs multiIndexSearch by joining indices", async () => {
      let capturedUrl = ""
      globalThis.fetch = mock(async (url: unknown) => {
        capturedUrl = String(url)
        return new Response(
          JSON.stringify({
            took: 2,
            hits: { total: { value: 0 }, hits: [] },
          }),
          { status: 200 }
        )
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({ host: "http://localhost:9200" })
      )
      await client.multiIndexSearch(["idx-1", "idx-2"], {
        term: { status: 200 },
      })
      expect(capturedUrl).toContain("/idx-1,idx-2/_search")
    })

    it("fetches indices and filters by pattern", async () => {
      globalThis.fetch = mock(async (url: unknown) => {
        if (String(url).includes("_cat/indices")) {
          return new Response(
            JSON.stringify([
              { index: "logs-2026-09-01" },
              { index: "logs-2026-09-02" },
              { index: "metrics-2026-09-01" },
            ]),
            { status: 200 }
          )
        }
        return new Response("Not found", { status: 404 })
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({ host: "http://localhost:9200" })
      )
      const indices = await client.getIndices()
      expect(indices).toEqual([
        "logs-2026-09-01",
        "logs-2026-09-02",
        "metrics-2026-09-01",
      ])

      const matched = await client.getIndicesByPattern("logs-*")
      expect(matched).toEqual(["logs-2026-09-01", "logs-2026-09-02"])

      // Catches errors gracefully
      globalThis.fetch = mock(async () => {
        throw new Error("HTTP error")
      }) as unknown as typeof fetch

      const empty = await client.getIndices()
      expect(empty).toEqual([])
    })

    it("fetches index mapping", async () => {
      let capturedUrl = ""
      globalThis.fetch = mock(async (url: unknown) => {
        capturedUrl = String(url)
        return new Response(
          JSON.stringify({ "logs-2026": { mappings: { properties: {} } } }),
          { status: 200 }
        )
      }) as unknown as typeof fetch

      const client = new OpenSearchClient(
        makeConfig({ host: "http://localhost:9200" })
      )
      const mapping = await client.getMapping("logs-2026")
      expect(capturedUrl).toContain("/logs-2026/_mapping")
      expect(mapping).toHaveProperty("logs-2026")
    })
  })

  describe("OpenSearchRegionClient", () => {
    it("instantiates region client and switches regions", () => {
      const client = new OpenSearchRegionClient("id-cgk-1")
      expect(client.getCurrentRegion()).toBe("id-cgk-1")

      const switched = client.switchRegion("sg-sin-1")
      expect(switched.getCurrentRegion()).toBe("sg-sin-1")

      const forReg = OpenSearchClient.forRegion("us-east-1")
      expect(forReg).toBeInstanceOf(OpenSearchClient)
    })
  })
})
