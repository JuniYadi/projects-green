import { getOpenSearchClient } from "@/lib/opensearch"
import { ensureLogIndex, getLogIndexName } from "./opensearch-index.service"
import type {
  LogEntry,
  LogQueryParams,
  LogQueryResult,
  DeployAggregation,
} from "./opensearch.types"

function logError(context: string, error: unknown): void {
  console.error(
    `[opensearch-log] ${context}:`,
    error instanceof Error ? error.message : String(error)
  )
}

export async function ingestLog(entry: LogEntry): Promise<boolean> {
  try {
    const indexName = await ensureLogIndex(entry.tenantSlug)
    const client = getOpenSearchClient()

    await client.index({
      index: indexName,
      body: {
        timestamp: entry.timestamp,
        level: entry.level,
        source: entry.source,
        message: entry.message,
        tenantSlug: entry.tenantSlug,
        stackId: entry.stackId,
        container: entry.container,
        buildId: entry.buildId,
        deployId: entry.deployId,
        metadata: entry.metadata,
      },
      refresh: false,
    })

    return true
  } catch (error) {
    logError("ingestLog failed", error)
    return false
  }
}

export async function ingestLogBatch(
  entries: LogEntry[]
): Promise<{ success: number; failed: number }> {
  if (entries.length === 0) return { success: 0, failed: 0 }

  const client = getOpenSearchClient()
  const indexName = await ensureLogIndex(entries[0].tenantSlug)

  const body = entries.flatMap((entry) => [
    { index: { _index: indexName } },
    {
      timestamp: entry.timestamp,
      level: entry.level,
      source: entry.source,
      message: entry.message,
      tenantSlug: entry.tenantSlug,
      stackId: entry.stackId,
      container: entry.container,
      buildId: entry.buildId,
      deployId: entry.deployId,
      metadata: entry.metadata,
    },
  ])

  try {
    const { body: result } = await client.bulk({ body })
    const failed =
      result.items?.filter(
        (item: { index?: { error?: unknown } }) => item.index?.error
      ).length ?? 0
    return { success: entries.length - failed, failed }
  } catch (error) {
    logError("ingestLogBatch failed", error)
    return { success: 0, failed: entries.length }
  }
}

export async function queryLogs(
  params: LogQueryParams
): Promise<LogQueryResult> {
  const client = getOpenSearchClient()
  const indexName = getLogIndexName(params.tenantSlug)

  // Check if index exists before attempting search
  try {
    const { body: exists } = await client.indices.exists({ index: indexName })
    if (!exists) {
      return { hits: [], total: 0, took: 0 }
    }
  } catch {
    // Connection error talking to OpenSearch — return empty rather than throwing
    logError("queryLogs: index existence check failed for " + indexName, "")
    return { hits: [], total: 0, took: 0 }
  }

  const must: Array<Record<string, unknown>> = [
    { match_phrase: { tenantSlug: params.tenantSlug } },
  ]

  if (params.query) {
    must.push({
      match: { message: { query: params.query, operator: "and" } },
    })
  }
  if (params.level) {
    must.push({ term: { level: params.level } })
  }
  if (params.stackId) {
    must.push({ term: { stackId: params.stackId } })
  }
  if (params.container) {
    must.push({ term: { container: params.container } })
  }
  if (params.deployId) {
    must.push({ term: { deployId: params.deployId } })
  }

  const filter: Array<Record<string, unknown>> = []
  if (params.from || params.to) {
    const range: Record<string, string> = {}
    if (params.from) range.gte = params.from
    if (params.to) range.lte = params.to
    filter.push({ range: { timestamp: range } })
  }

  try {
    const { body } = (await client.search({
      index: indexName,
      body: {
        query: {
          bool: { must, filter },
        },
        sort: [{ timestamp: { order: "desc" } }],
        from: params.fromOffset ?? 0,
        size: params.size ?? 100,
      },
    })) as {
      body: {
        hits: {
          hits: Array<{ _source?: LogEntry }>
          total: { value: number } | number
        }
        took: number
      }
    }

    const hits = body.hits.hits.map(
      (hit: { _source?: LogEntry }) => hit._source as LogEntry
    )
    const total =
      typeof body.hits.total === "object"
        ? body.hits.total.value
        : ((body.hits.total as number) ?? 0)

    return {
      hits,
      total,
      took: body.took,
    }
  } catch (error) {
    logError("queryLogs: search failed for " + indexName, error)
    return { hits: [], total: 0, took: 0 }
  }
}

export async function getDeployAggregation(
  tenantSlug: string,
  from?: string,
  to?: string
): Promise<DeployAggregation> {
  const client = getOpenSearchClient()
  const indexName = getLogIndexName(tenantSlug)

  // Check if index exists before aggregating
  try {
    const { body: exists } = await client.indices.exists({ index: indexName })
    if (!exists) {
      return emptyAggregation()
    }
  } catch {
    return emptyAggregation()
  }

  const filter: Array<Record<string, unknown>> = [
    { match_phrase: { tenantSlug } },
  ]
  if (from || to) {
    const range: Record<string, string> = {}
    if (from) range.gte = from
    if (to) range.lte = to
    filter.push({ range: { timestamp: range } })
  }

  try {
    const { body } = (await client.search({
      index: indexName,
      body: {
        size: 0,
        query: { bool: { filter } },
        aggs: {
          by_date: {
            date_histogram: {
              field: "timestamp",
              calendar_interval: "day",
            },
          },
          success_rate: {
            filter: { term: { source: "deploy" } },
            aggs: {
              success: {
                filter: {
                  bool: {
                    must: [
                      { term: { level: "INFO" } },
                      { match_phrase: { message: "deployed successfully" } },
                    ],
                  },
                },
              },
            },
          },
          avg_duration: {
            avg: {
              field: "metadata.durationMs",
            },
          },
        },
      },
    })) as {
      body: {
        aggregations?: Record<
          string,
          {
            buckets?: Array<{ key_as_string: string; doc_count: number }>
            doc_count: number
            success?: { doc_count: number }
            value?: number
          }
        >
      }
    }

    const aggs = body.aggregations
    const freqBuckets = aggs?.by_date?.buckets ?? []
    const successAgg = aggs?.success_rate ?? {
      doc_count: 0,
      success: { doc_count: 0 },
    }

    const total: number = successAgg.doc_count
    const success: number = successAgg.success?.doc_count ?? 0

    return {
      deployFrequency: freqBuckets.map(
        (bucket: { key_as_string: string; doc_count: number }) => ({
          date: bucket.key_as_string,
          count: bucket.doc_count,
        })
      ),
      successRate: {
        total,
        success,
        failed: total - success,
        rate: total > 0 ? Math.round((success / total) * 100) : 0,
      },
      avgDurationMs: Math.round(aggs?.avg_duration?.value ?? 0),
    }
  } catch (error) {
    logError("getDeployAggregation failed", error)
    return emptyAggregation()
  }
}

function emptyAggregation(): DeployAggregation {
  return {
    deployFrequency: [],
    successRate: { total: 0, success: 0, failed: 0, rate: 0 },
    avgDurationMs: 0,
  }
}
