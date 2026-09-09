import { Client } from "@opensearch-project/opensearch"

import { prisma } from "@/lib/prisma"
import { getOpenSearchClient } from "@/lib/opensearch"
import {
  resolveClusterIntegration,
  resolveClusterIntegrationByClusterCode,
  type OpenSearchClusterConfig,
} from "../cluster-integration.service"
import {
  normalizeOpenSearchLogDoc,
  type NormalizedLogEntry,
} from "./opensearch-log-normalizer"
export type AppLogsQueryParams = {
  slug: string
  q?: string
  level?: "ALL" | "INFO" | "WARN" | "ERROR"
  source?: string
  from?: string
  to?: string
  limit?: number
  order?: "desc" | "asc"
}

export type AppLogsQueryResult = {
  hits: NormalizedLogEntry[]
  total: number
  took: number
}

// Client cache keyed by endpoint + username
const clientCache = new Map<string, Client>()

function getCachedClient(config: OpenSearchClusterConfig): Client {
  const key = `${config.endpoint}::${config.username}`
  let client = clientCache.get(key)
  if (!client) {
    client = new Client({
      node: config.endpoint,
      auth: {
        username: config.username,
        password: config.password,
      },
      ssl: {
        rejectUnauthorized: config.sslVerify,
      },
    })
    clientCache.set(key, client)
  }
  return client
}
export type ResolvedAppClientInfo = {
  client: Client
  namespace: string
  organizationId: string | null
  orgNamespace: string | null
}

export async function resolveOpenSearchClientForApp(
  slug: string
): Promise<ResolvedAppClientInfo> {
  const namespace = `app-${slug}`

  const stack = await prisma.applicationStack.findFirst({
    where: { slug },
    select: { id: true, clusterId: true, organizationId: true },
  })

  const orgId = stack?.organizationId ?? null
  const orgNamespace = orgId
    ? `app-${orgId.replace(/^org_/, "").toLowerCase().replace(/_/g, "-")}`
    : null

  if (stack) {
    try {
      const config = await resolveClusterIntegration(stack.id, "OPENSEARCH")
      return {
        client: getCachedClient(config),
        namespace,
        organizationId: orgId,
        orgNamespace,
      }
    } catch {
      // Integration not configured or failed to resolve for stack
    }
  }

  // Fallback to default active cluster
  try {
    const defaultCluster = await prisma.appHostingCluster.findFirst({
      where: { status: "ACTIVE", isDefault: true },
      select: { code: true },
    })
    if (defaultCluster) {
      const config = await resolveClusterIntegrationByClusterCode(
        defaultCluster.code,
        "OPENSEARCH"
      )
      return {
        client: getCachedClient(config),
        namespace,
        organizationId: orgId,
        orgNamespace,
      }
    }
  } catch {
    // Fallback to env-configured client
  }

  return {
    client: getOpenSearchClient(),
    namespace,
    organizationId: orgId,
    orgNamespace,
  }
}

function buildSearchQuery(
  params: AppLogsQueryParams,
  namespaceFilters?: string[]
) {
  const must: Record<string, unknown>[] = []
  const filter: Record<string, unknown>[] = []

  if (namespaceFilters && namespaceFilters.length > 0) {
    filter.push({
      bool: {
        should: [
          ...namespaceFilters.map((ns) => ({
            term: { "kubernetes.namespace_name.keyword": ns },
          })),
          {
            term: {
              "kubernetes.labels.app\\.kubernetes\\.io/instance.keyword":
                params.slug,
            },
          },
          {
            term: {
              "kubernetes.labels.app\\.kubernetes\\.io/name.keyword":
                params.slug,
            },
          },
          { wildcard: { "kubernetes.pod_name.keyword": `*${params.slug}*` } },
        ],
        minimum_should_match: 1,
      },
    })
  }

  // Text search query across message / msg / log fields
  if (params.q && params.q.trim().length > 0) {
    must.push({
      multi_match: {
        query: params.q.trim(),
        fields: ["message", "msg", "log"],
        type: "phrase_prefix",
      },
    })
  }

  // Source / container filter
  if (params.source && params.source.trim().length > 0) {
    filter.push({
      bool: {
        should: [
          {
            term: { "kubernetes.container_name.keyword": params.source.trim() },
          },
          { term: { "kubernetes.pod_name.keyword": params.source.trim() } },
          { term: { "context.keyword": params.source.trim() } },
        ],
        minimum_should_match: 1,
      },
    })
  }

  // Level filter
  if (params.level && params.level !== "ALL") {
    if (params.level === "ERROR") {
      filter.push({
        bool: {
          should: [
            { range: { level: { gte: 50 } } },
            { term: { "level.keyword": "ERROR" } },
            { term: { "level.keyword": "error" } },
            { term: { "stream.keyword": "stderr" } },
            { wildcard: { message: "*ERROR*" } },
            { wildcard: { message: "*error*" } },
          ],
          minimum_should_match: 1,
        },
      })
    } else if (params.level === "WARN") {
      filter.push({
        bool: {
          should: [
            { term: { level: 40 } },
            { term: { "level.keyword": "WARN" } },
            { term: { "level.keyword": "warn" } },
            { term: { "level.keyword": "warning" } },
            { wildcard: { message: "*WARN*" } },
            { wildcard: { message: "*warn*" } },
          ],
          minimum_should_match: 1,
        },
      })
    } else if (params.level === "INFO") {
      filter.push({
        bool: {
          should: [
            { range: { level: { lte: 30 } } },
            { term: { "level.keyword": "INFO" } },
            { term: { "level.keyword": "info" } },
            { term: { "stream.keyword": "stdout" } },
          ],
          minimum_should_match: 1,
        },
      })
    }
  }

  // Timestamp range filter
  if (params.from || params.to) {
    const range: Record<string, string> = {}
    if (params.from) range.gte = params.from
    if (params.to) range.lte = params.to
    filter.push({
      range: {
        "@timestamp": range,
      },
    })
  }

  return {
    bool: {
      must: must.length > 0 ? must : [{ match_all: {} }],
      filter: filter.length > 0 ? filter : undefined,
    },
  }
}

export async function queryAppLogs(
  params: AppLogsQueryParams
): Promise<AppLogsQueryResult> {
  const { client, namespace, orgNamespace } =
    await resolveOpenSearchClientForApp(params.slug)
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000)
  const order = params.order ?? "desc"

  const candidateIndices = [
    `app-${params.slug}-*`,
    orgNamespace ? `${orgNamespace}-*` : null,
  ].filter(Boolean)
  const primaryIndex = candidateIndices.join(",")
  const query = buildSearchQuery(params)
  try {
    const response = await client.search({
      index: primaryIndex,
      body: {
        size: limit,
        sort: [{ "@timestamp": { order, unmapped_type: "date" } }],
        query,
      },
    })

    const body = (response.body ?? response) as {
      took?: number
      _shards?: { total: number }
      hits?: {
        total?: number | { value: number }
        hits?: Array<{
          _id?: string
          _index?: string
          _source?: Record<string, unknown>
        }>
      }
    }

    const rawHits = body.hits?.hits ?? []
    const rawTotal = body.hits?.total
    const total =
      typeof rawTotal === "number" ? rawTotal : (rawTotal?.value ?? 0)

    // If primary index pattern has 0 shards (e.g. index not created yet),
    // try fallback search across all app-* indices filtered by namespace
    if (rawHits.length === 0 && (body._shards?.total ?? 0) === 0) {
      const namespaces = [namespace, orgNamespace].filter(Boolean) as string[]
      const fallbackQuery = buildSearchQuery(params, namespaces)
      try {
        const fallbackRes = await client.search({
          index: "app-*",
          body: {
            size: limit,
            sort: [{ "@timestamp": { order, unmapped_type: "date" } }],
            query: fallbackQuery,
          },
        })
        const fbBody = (fallbackRes.body ?? fallbackRes) as {
          took?: number
          hits?: {
            total?: number | { value: number }
            hits?: Array<{
              _id?: string
              _index?: string
              _source?: Record<string, unknown>
            }>
          }
        }
        const fbHits = fbBody.hits?.hits ?? []
        const fbRawTotal = fbBody.hits?.total
        const fbTotal =
          typeof fbRawTotal === "number" ? fbRawTotal : (fbRawTotal?.value ?? 0)

        const normalized = fbHits.map(normalizeOpenSearchLogDoc)
        return {
          hits: normalized,
          total: fbTotal,
          took: fbBody.took ?? 0,
        }
      } catch {
        // Return clean empty result if fallback also fails
      }
    }

    const normalized = rawHits.map(normalizeOpenSearchLogDoc)
    return {
      hits: normalized,
      total,
      took: body.took ?? 0,
    }
  } catch (error) {
    // If index does not exist, return empty result gracefully instead of 500
    const errMessage = error instanceof Error ? error.message : String(error)
    if (errMessage.includes("index_not_found_exception")) {
      return { hits: [], total: 0, took: 0 }
    }
    console.error(
      `[opensearch-query] queryAppLogs failed for ${params.slug}:`,
      error
    )
    return { hits: [], total: 0, took: 0 }
  }
}
