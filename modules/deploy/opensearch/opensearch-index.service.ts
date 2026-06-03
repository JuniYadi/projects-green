import { getOpenSearchClient } from "@/lib/opensearch"

const LOG_INDEX_MAPPING = {
  properties: {
    timestamp: { type: "date" },
    level: { type: "keyword" },
    source: { type: "keyword" },
    message: { type: "text", analyzer: "standard" },
    tenantSlug: { type: "keyword" },
    stackId: { type: "keyword" },
    container: { type: "keyword" },
    buildId: { type: "keyword" },
    deployId: { type: "keyword" },
    metadata: { type: "object", enabled: false },
  },
} as const

export function getLogIndexName(
  tenantSlug: string,
  date: Date = new Date()
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `deploy-logs-${tenantSlug}-${year}.${month}`
}

export async function ensureLogIndex(
  tenantSlug: string,
  region?: string
): Promise<string> {
  const client = getOpenSearchClient(region)
  const indexName = getLogIndexName(tenantSlug)

  const { body: exists } = await client.indices.exists({ index: indexName })
  if (!exists) {
    await client.indices.create({
      index: indexName,
      body: {
        mappings: LOG_INDEX_MAPPING,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          "index.refresh_interval": "5s",
        },
      },
    })
  }

  return indexName
}

export async function rotateIndices(
  tenantSlug: string,
  region?: string
): Promise<void> {
  const client = getOpenSearchClient(region)
  const currentIndex = getLogIndexName(tenantSlug)

  const { body: exists } = await client.indices.exists({
    index: currentIndex,
  })
  if (!exists) {
    await ensureLogIndex(tenantSlug, region)
  }
}
