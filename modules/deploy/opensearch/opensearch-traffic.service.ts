import { Client } from "@opensearch-project/opensearch"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { logger } from "@/lib/logger"
import { resolveClusterIntegrationByClusterCode } from "../cluster-integration.service"
import {
  computeSuccessRatio,
  enrichTopIpsWithGeo,
  type IpGeoInfo,
} from "./geoip-lookup.service"
import {
  BOT_SIGNAL_FRAGMENTS,
  CLI_CLIENT_SIGNAL_FRAGMENTS,
  parseUserAgent,
} from "./ua-parser.service"
import type {
  AppTrafficLogItemDTO,
  AppTrafficLogsDTO,
  AppTrafficReportDTO,
  AudienceBucket,
  DailySnapshotComputeResult,
  TrafficAudienceBreakdown,
  TrafficCountryCount,
  TrafficErrorPath,
  TrafficPathCount,
  TrafficRequestQuality,
  TrafficTrendItem,
} from "./opensearch-traffic.types"

const opensearchClientCache = new Map<string, Client>()

export function getOpenSearchClientForCluster(
  endpoint: string,
  username: string,
  password?: string,
  sslVerify = true
): Client {
  const key = `${endpoint}::${username}`
  let client = opensearchClientCache.get(key)
  if (!client) {
    client = new Client({
      node: endpoint,
      auth: password ? { username, password } : undefined,
      ssl: { rejectUnauthorized: sslVerify },
    })
    opensearchClientCache.set(key, client)
  }
  return client
}

export function formatBytes(bytes: bigint | number): string {
  const num = typeof bytes === "bigint" ? Number(bytes) : bytes
  if (num <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(num) / Math.log(1024))
  const formatted = (num / Math.pow(1024, i)).toFixed(1)
  return `${formatted} ${units[i] ?? "B"}`
}

/**
 * Fills in status2xx/3xx/4xx/5xx/successRatio for IpGeoInfo rows persisted
 * before those fields existed, so old snapshots degrade to an honest
 * "no evidence" state instead of throwing on undefined.
 */
function normalizeIpGeoInfo(item: IpGeoInfo): IpGeoInfo {
  return {
    ...item,
    status2xx: item.status2xx ?? 0,
    status3xx: item.status3xx ?? 0,
    status4xx: item.status4xx ?? 0,
    status5xx: item.status5xx ?? 0,
    // No recorded breakdown at all (pre-this-change snapshot) reads as 100,
    // matching this file's existing "no data -> 100" successRate convention
    // -- distinct from a *measured* 0% which requires real status evidence.
    successRatio: item.successRatio ?? 100,
  }
}

/** Recomputes successRatio after summing status counts across snapshots, keeping the "no evidence -> 100" default when nothing was ever recorded. */
function recomputeSuccessRatio(ip: IpGeoInfo): number {
  const statusEvidence =
    ip.status2xx + ip.status3xx + ip.status4xx + ip.status5xx
  // Divide by the evidenced volume, not requestsCount: a merge can mix an
  // evidenced snapshot with a legacy one that has real request volume but
  // zero recorded status, and that unevidenced volume must not get silently
  // counted as failure in the denominator.
  return statusEvidence > 0
    ? computeSuccessRatio(ip.status2xx, statusEvidence)
    : 100
}

export function computeTopCountries(
  topIps: IpGeoInfo[]
): TrafficCountryCount[] {
  const countryMap = new Map<
    string,
    { countryCode: string; countryName: string; requests: number }
  >()
  let totalIpRequests = 0

  for (const item of topIps) {
    totalIpRequests += item.requestsCount
    const code = item.countryCode || "UNKNOWN"
    const name = item.countryName || "Tidak Diketahui"
    const existing = countryMap.get(code)
    if (existing) {
      existing.requests += item.requestsCount
    } else {
      countryMap.set(code, {
        countryCode: code,
        countryName: name,
        requests: item.requestsCount,
      })
    }
  }

  return Array.from(countryMap.values())
    .map((c) => ({
      countryCode: c.countryCode,
      countryName: c.countryName,
      requests: c.requests,
      percentage:
        totalIpRequests > 0
          ? Math.round((c.requests / totalIpRequests) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.requests - a.requests)
}

// ponytail: IP-cardinality only, not IP+normalized-UA per the issue's own
// definition -- combining two fields in a cardinality agg needs an inline
// script, and the issue itself flags scripts may be disabled on the
// cluster. Upgrade path: an ingest-time visitor-fingerprint field (also
// flagged in the issue as the likely real fix), then bump this to v2 and
// swap the aggregation's field.
const VISITOR_ESTIMATE_METHOD = "ip_cardinality_v1"

const EMPTY_AUDIENCE: TrafficAudienceBreakdown = {
  device: [],
  browser: [],
  os: [],
}

/**
 * Legacy snapshot rows have audienceJson: {} (the column default), not
 * null -- missing device/browser/os keys, not a missing object. Normalize
 * both cases the same way instead of relying on `?? EMPTY_AUDIENCE`, which
 * only catches null/undefined and would let `{}` through with undefined
 * arrays that break downstream .map() calls.
 */
function normalizeAudience(raw: unknown): TrafficAudienceBreakdown {
  const a = (raw ?? {}) as Partial<TrafficAudienceBreakdown>
  return {
    device: a.device ?? [],
    browser: a.browser ?? [],
    os: a.os ?? [],
  }
}

/** Top 5 labels by count, remainder rolled into a single "Other" bucket. */
function buildTop5WithOther(counts: Map<string, number>): AudienceBucket[] {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  const pct = (n: number) =>
    total > 0 ? Math.round((n / total) * 1000) / 10 : 0
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  const buckets: AudienceBucket[] = sorted
    .slice(0, 5)
    .map(([label, count]) => ({ label, count, percentage: pct(count) }))
  const otherCount = sorted.slice(5).reduce((sum, [, c]) => sum + c, 0)
  if (otherCount > 0) {
    buckets.push({
      label: "Other",
      count: otherCount,
      percentage: pct(otherCount),
    })
  }
  return buckets
}

function mergeBucketLists(lists: AudienceBucket[][]): AudienceBucket[] {
  const counts = new Map<string, number>()
  for (const list of lists) {
    for (const b of list)
      counts.set(b.label, (counts.get(b.label) ?? 0) + b.count)
  }
  return buildTop5WithOther(counts)
}

/**
 * Merges already-compacted (top-5 + Other) daily breakdowns into one. Each
 * day already discarded detail beyond its own top 5, so a label that never
 * made a single day's top 5 can't be recovered here -- same accepted
 * lossy-rollup tradeoff this file already makes for topPaths/topIps.
 */
export function mergeAudienceBreakdown(
  lists: TrafficAudienceBreakdown[]
): TrafficAudienceBreakdown {
  return {
    device: mergeBucketLists(lists.map((a) => a.device)),
    browser: mergeBucketLists(lists.map((a) => a.browser)),
    os: mergeBucketLists(lists.map((a) => a.os)),
  }
}

/**
 * Builds the period-wide request-quality breakdown. Percentages are against
 * the sum of the 4 buckets, not totalRequests -- so a period mixing fresh
 * (evidenced) data with pre-migration snapshots (no breakdown recorded)
 * doesn't get its ratios diluted by the unevidenced volume. hasBreakdown is
 * false only when nothing in the period was ever measured.
 */
export function computeRequestQuality(
  rawStatus2xx: number,
  rawStatus3xx: number,
  rawStatus4xx: number,
  rawStatus5xx: number
): TrafficRequestQuality {
  const status2xx = rawStatus2xx ?? 0
  const status3xx = rawStatus3xx ?? 0
  const status4xx = rawStatus4xx ?? 0
  const status5xx = rawStatus5xx ?? 0
  const total = status2xx + status3xx + status4xx + status5xx
  const pct = (n: number) =>
    total > 0 ? Math.round((n / total) * 1000) / 10 : 0
  return {
    status2xx,
    status3xx,
    status4xx,
    status5xx,
    status2xxPct: pct(status2xx),
    status3xxPct: pct(status3xx),
    status4xxPct: pct(status4xx),
    status5xxPct: pct(status5xx),
    hasBreakdown: total > 0,
  }
}

export async function resolveOpenSearchForStack(
  stackIdOrSlug: string
): Promise<{
  client: Client
  stack: {
    id: string
    slug: string
    name: string
    organizationId: string
    clusterId: string | null
    customDomain: string | null
    subdomain: string | null
    domains?: Array<{ hostname: string }>
  }
  clusterCode: string
  domainList: string[]
}> {
  const stack = await prisma.applicationStack.findFirst({
    where: {
      OR: [{ id: stackIdOrSlug }, { slug: stackIdOrSlug }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      organizationId: true,
      clusterId: true,
      customDomain: true,
      subdomain: true,
      domains: {
        select: {
          hostname: true,
        },
      },
      cluster: {
        select: {
          code: true,
        },
      },
    },
  })

  if (!stack) {
    throw new Error(
      `ApplicationStack not found for identifier: ${stackIdOrSlug}`
    )
  }

  const domainList = Array.from(
    new Set(
      [
        stack.customDomain,
        stack.subdomain,
        ...(stack.domains?.map((d) => d.hostname) ?? []),
      ].filter(Boolean) as string[]
    )
  )

  const clusterCode = stack.cluster?.code ?? "sgp"
  const config = await resolveClusterIntegrationByClusterCode(
    clusterCode,
    "OPENSEARCH"
  )
  const client = getOpenSearchClientForCluster(
    config.endpoint,
    config.username,
    config.password,
    config.sslVerify
  )

  return { client, stack, clusterCode, domainList }
}

/**
 * Query-time equivalent of parseUserAgent()'s bot/CLI signal check, built
 * from the SAME fragment lists (see ua-parser.service.ts) so the per-hour
 * chart split and the per-UA classifier can't silently drift apart. Missing
 * or empty User-Agent counts as automated too, matching parseUserAgent.
 * case_insensitive avoids depending on the index having a lowercase
 * normalizer on user_agent.keyword, which this repo doesn't control.
 */
function buildAutomatedUaFilter(): Record<string, unknown> {
  const fragments = [...BOT_SIGNAL_FRAGMENTS, ...CLI_CLIENT_SIGNAL_FRAGMENTS]
  return {
    bool: {
      should: [
        ...fragments.map((f) => ({
          wildcard: {
            "user_agent.keyword": { value: `*${f}*`, case_insensitive: true },
          },
        })),
        { bool: { must_not: { exists: { field: "user_agent.keyword" } } } },
        { term: { "user_agent.keyword": "" } },
      ],
      minimum_should_match: 1,
    },
  }
}

/**
 * Builds OpenSearch query filter for matching an application stack's traffic.
 * Prefers exact FQDN matching on `haproxy_host.keyword` with fallback to backend prefix.
 */
function buildStackFilterClause(
  domainList: string[] = [],
  stackSlug = ""
): Record<string, unknown> {
  const validDomains = Array.isArray(domainList)
    ? domainList.filter(Boolean)
    : []
  if (validDomains.length > 0) {
    return {
      terms: {
        "haproxy_host.keyword": validDomains,
      },
    }
  }
  return {
    prefix: {
      "haproxy_backend.keyword": `app-${stackSlug}_svc_`,
    },
  }
}

/**
 * Computes calendar day traffic snapshot from OpenSearch for an application stack.
 * Date is treated strictly in UTC: [startOfDay, endOfDay].
 */
export async function computeDailyTrafficSnapshotFromOpenSearch(
  stackIdOrSlug: string,
  targetDate: Date,
  injectedClient?: Client
): Promise<DailySnapshotComputeResult> {
  let client: Client
  let stackSlug: string
  let stackId: string
  let domainList: string[] = []

  if (injectedClient) {
    const s = await prisma.applicationStack.findFirst({
      where: { OR: [{ id: stackIdOrSlug }, { slug: stackIdOrSlug }] },
      select: {
        id: true,
        slug: true,
        customDomain: true,
        subdomain: true,
        domains: { select: { hostname: true } },
      },
    })
    if (!s) {
      throw new Error(
        `ApplicationStack not found for identifier: ${stackIdOrSlug}`
      )
    }
    client = injectedClient
    stackSlug = s.slug
    stackId = s.id
    domainList = Array.from(
      new Set(
        [
          s.customDomain,
          s.subdomain,
          ...(s.domains?.map((d) => d.hostname) ?? []),
        ].filter(Boolean) as string[]
      )
    )
  } else {
    const resolved = await resolveOpenSearchForStack(stackIdOrSlug)
    client = resolved.client
    stackSlug = resolved.stack.slug
    stackId = resolved.stack.id
    domainList = resolved.domainList
  }

  const startOfDay = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )
  const endOfDay = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  )

  const queryPayload: Record<string, unknown> = {
    size: 0,
    query: {
      bool: {
        filter: [
          {
            range: {
              "@timestamp": {
                gte: startOfDay.toISOString(),
                lte: endOfDay.toISOString(),
              },
            },
          },
          buildStackFilterClause(domainList, stackSlug),
        ],
      },
    },
    aggs: {
      status_codes: {
        terms: { field: "http_status", size: 50 },
      },
      avg_latency: {
        avg: { field: "response_time_ms" },
      },
      total_bytes: {
        sum: { field: "bytes_read" },
      },
      hourly_trend: {
        date_histogram: {
          field: "@timestamp",
          fixed_interval: "1h",
          min_doc_count: 0,
          extended_bounds: {
            min: startOfDay.toISOString(),
            max: endOfDay.toISOString(),
          },
        },
        aggs: {
          errors: {
            filter: {
              range: { http_status: { gte: 400 } },
            },
          },
          automated: {
            filter: buildAutomatedUaFilter(),
          },
          visitor_cardinality: {
            cardinality: { field: "client_ip.keyword" },
          },
        },
      },
      visitor_cardinality: {
        cardinality: { field: "client_ip.keyword" },
      },
      top_paths: {
        terms: { field: "http_path.keyword", size: 5 },
      },
      top_ips: {
        terms: { field: "client_ip.keyword", size: 10 },
        aggs: {
          status_class: {
            range: {
              field: "http_status",
              ranges: [
                { key: "2xx", from: 200, to: 300 },
                { key: "3xx", from: 300, to: 400 },
                { key: "4xx", from: 400, to: 500 },
                { key: "5xx", from: 500 },
              ],
            },
          },
        },
      },
      user_agent_buckets: {
        // Enough distinct UA strings to represent the day's audience without
        // parsing every document; parsed once per unique string, server-side.
        terms: { field: "user_agent.keyword", size: 100 },
      },
      error_paths: {
        filter: {
          range: { http_status: { gte: 400 } },
        },
        aggs: {
          paths: {
            terms: { field: "http_path.keyword", size: 5 },
            aggs: {
              sample_status: {
                terms: { field: "http_status", size: 1 },
              },
            },
          },
        },
      },
    },
  }

  let totalRequests = 0
  let successCount = 0
  let errorCount = 0
  let status2xx = 0
  let status3xx = 0
  let status4xx = 0
  let status5xx = 0
  let totalBytes = BigInt(0)
  let avgLatencyMs = 0
  const hourlyTrend: DailySnapshotComputeResult["hourlyTrend"] = []
  let dayVisitorCardinality = 0
  const topPaths: TrafficPathCount[] = []
  const errorPaths: TrafficErrorPath[] = []
  const rawTopIps: Array<{
    ip: string
    count: number
    status2xx: number
    status3xx: number
    status4xx: number
    status5xx: number
  }> = []
  const deviceCounts = new Map<string, number>()
  const browserCounts = new Map<string, number>()
  const osCounts = new Map<string, number>()

  try {
    const rawClient = client as unknown as {
      search: (
        params: Record<string, unknown>
      ) => Promise<Record<string, unknown>>
    }
    const response = await rawClient.search({
      index: "haproxy-controller-*",
      body: queryPayload,
    })
    const rawRes = response as unknown as {
      body?: { aggregations?: Record<string, unknown> }
      aggregations?: Record<string, unknown>
    }
    const aggs = (rawRes.body?.aggregations ?? rawRes.aggregations ?? {}) as {
      status_codes?: { buckets: Array<{ key: number; doc_count: number }> }
      avg_latency?: { value: number | null }
      total_bytes?: { value: number | null }
      hourly_trend?: {
        buckets: Array<{
          key_as_string: string
          doc_count: number
          errors?: { doc_count: number }
          automated?: { doc_count: number }
          visitor_cardinality?: { value: number }
        }>
      }
      visitor_cardinality?: { value: number }
      top_paths?: { buckets: Array<{ key: string; doc_count: number }> }
      top_ips?: {
        buckets: Array<{
          key: string
          doc_count: number
          status_class?: {
            buckets: Array<{ key: string; doc_count: number }>
          }
        }>
      }
      user_agent_buckets?: {
        buckets: Array<{ key: string; doc_count: number }>
      }
      error_paths?: {
        paths?: {
          buckets: Array<{
            key: string
            doc_count: number
            sample_status?: { buckets: Array<{ key: number }> }
          }>
        }
      }
    }

    dayVisitorCardinality = aggs.visitor_cardinality?.value ?? 0

    if (aggs.status_codes?.buckets) {
      for (const bucket of aggs.status_codes.buckets) {
        totalRequests += bucket.doc_count
        if (bucket.key >= 200 && bucket.key < 300) status2xx += bucket.doc_count
        else if (bucket.key >= 300 && bucket.key < 400)
          status3xx += bucket.doc_count
        else if (bucket.key >= 400 && bucket.key < 500)
          status4xx += bucket.doc_count
        else if (bucket.key >= 500) status5xx += bucket.doc_count
        if (bucket.key >= 400) {
          errorCount += bucket.doc_count
        } else {
          successCount += bucket.doc_count
        }
      }
    }

    if (
      aggs.avg_latency?.value !== null &&
      aggs.avg_latency?.value !== undefined
    ) {
      avgLatencyMs = Math.round(aggs.avg_latency.value)
    }

    if (
      aggs.total_bytes?.value !== null &&
      aggs.total_bytes?.value !== undefined
    ) {
      totalBytes = BigInt(Math.round(aggs.total_bytes.value))
    }

    if (aggs.hourly_trend?.buckets) {
      for (let i = 0; i < aggs.hourly_trend.buckets.length; i++) {
        const b = aggs.hourly_trend.buckets[i]
        const hour = new Date(b.key_as_string).getUTCHours()
        hourlyTrend.push({
          hour,
          requests: b.doc_count,
          errors: b.errors?.doc_count ?? 0,
          visitors: b.visitor_cardinality?.value ?? 0,
          automated: b.automated?.doc_count ?? 0,
        })
      }
    }

    if (aggs.top_paths?.buckets) {
      for (const b of aggs.top_paths.buckets) {
        topPaths.push({
          path: b.key,
          views: b.doc_count,
        })
      }
    }

    if (aggs.top_ips?.buckets) {
      for (const b of aggs.top_ips.buckets) {
        const statusBuckets = b.status_class?.buckets ?? []
        const statusCount = (key: string) =>
          statusBuckets.find((s) => s.key === key)?.doc_count ?? 0
        rawTopIps.push({
          ip: b.key,
          count: b.doc_count,
          status2xx: statusCount("2xx"),
          status3xx: statusCount("3xx"),
          status4xx: statusCount("4xx"),
          status5xx: statusCount("5xx"),
        })
      }
    }

    if (aggs.user_agent_buckets?.buckets) {
      for (const b of aggs.user_agent_buckets.buckets) {
        const parsed = parseUserAgent(b.key)
        const device = parsed.deviceClass
        const browser = parsed.browserFamily
        const os = parsed.osFamily
        deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + b.doc_count)
        browserCounts.set(
          browser,
          (browserCounts.get(browser) ?? 0) + b.doc_count
        )
        osCounts.set(os, (osCounts.get(os) ?? 0) + b.doc_count)
      }
    }

    const errBuckets = aggs.error_paths?.paths?.buckets ?? []
    for (const b of errBuckets) {
      errorPaths.push({
        path: b.key,
        errors: b.doc_count,
        sampleStatus: b.sample_status?.buckets?.[0]?.key ?? 500,
      })
    }
  } catch (error) {
    logger.warn(
      {
        event: "TRAFFIC_SNAPSHOT_COMPUTE_FAILED",
        stackId,
        slug: stackSlug,
        targetDate: startOfDay.toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to compute daily traffic snapshot from OpenSearch"
    )
  }

  const topIps = await enrichTopIpsWithGeo(rawTopIps)
  const audience: TrafficAudienceBreakdown = {
    device: buildTop5WithOther(deviceCounts),
    browser: buildTop5WithOther(browserCounts),
    os: buildTop5WithOther(osCounts),
  }
  const automatedRequests = hourlyTrend.reduce((sum, h) => sum + h.automated, 0)

  return {
    stackId,
    date: startOfDay,
    totalRequests,
    successCount,
    errorCount,
    status2xx,
    status3xx,
    status4xx,
    status5xx,
    totalBytes,
    avgLatencyMs,
    hourlyTrend,
    topPaths,
    errorPaths,
    topIps,
    audience,
    automatedRequests,
    visitorEstimate: dayVisitorCardinality,
    visitorEstimateMethod: VISITOR_ESTIMATE_METHOD,
  }
}

/**
 * Upserts computed daily traffic snapshot to PostgreSQL.
 */
export async function saveDailyTrafficSnapshot(
  snapshot: DailySnapshotComputeResult
): Promise<void> {
  await prisma.appHostingDailyTrafficSnapshot.upsert({
    where: {
      stackId_date: {
        stackId: snapshot.stackId,
        date: snapshot.date,
      },
    },
    update: {
      totalRequests: snapshot.totalRequests,
      successCount: snapshot.successCount,
      errorCount: snapshot.errorCount,
      status2xxCount: snapshot.status2xx,
      status3xxCount: snapshot.status3xx,
      status4xxCount: snapshot.status4xx,
      status5xxCount: snapshot.status5xx,
      totalBytes: snapshot.totalBytes,
      avgLatencyMs: snapshot.avgLatencyMs,
      hourlyTrendJson: snapshot.hourlyTrend,
      topPathsJson: snapshot.topPaths as unknown as Prisma.InputJsonValue,
      errorPathsJson: snapshot.errorPaths as unknown as Prisma.InputJsonValue,
      topIpsJson: snapshot.topIps as unknown as Prisma.InputJsonValue,
      audienceJson: snapshot.audience as unknown as Prisma.InputJsonValue,
      automatedCount: snapshot.automatedRequests,
      visitorEstimate: snapshot.visitorEstimate,
      visitorEstMethod: snapshot.visitorEstimateMethod,
    },
    create: {
      stackId: snapshot.stackId,
      date: snapshot.date,
      totalRequests: snapshot.totalRequests,
      successCount: snapshot.successCount,
      errorCount: snapshot.errorCount,
      status2xxCount: snapshot.status2xx,
      status3xxCount: snapshot.status3xx,
      status4xxCount: snapshot.status4xx,
      status5xxCount: snapshot.status5xx,
      totalBytes: snapshot.totalBytes,
      avgLatencyMs: snapshot.avgLatencyMs,
      hourlyTrendJson: snapshot.hourlyTrend,
      topPathsJson: snapshot.topPaths as unknown as Prisma.InputJsonValue,
      errorPathsJson: snapshot.errorPaths as unknown as Prisma.InputJsonValue,
      topIpsJson: snapshot.topIps as unknown as Prisma.InputJsonValue,
      audienceJson: snapshot.audience as unknown as Prisma.InputJsonValue,
      automatedCount: snapshot.automatedRequests,
      visitorEstimate: snapshot.visitorEstimate,
      visitorEstMethod: snapshot.visitorEstimateMethod,
    },
  })
}

/**
 * Cron execution handler for daily traffic snapshots.
 * Runs at 01:00 UTC to snapshot T-1 calendar day across all active stacks.
 */
export async function processDailyTrafficSnapshotsJob(
  targetDate?: Date
): Promise<{
  processed: number
  failed: number
}> {
  const date = targetDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday

  const stacks = await prisma.applicationStack.findMany({
    where: {
      status: "RUNNING",
    },
    select: {
      id: true,
      slug: true,
    },
  })

  let processed = 0
  let failed = 0

  for (const stack of stacks) {
    try {
      const computed = await computeDailyTrafficSnapshotFromOpenSearch(
        stack.id,
        date
      )
      await saveDailyTrafficSnapshot(computed)
      processed++
    } catch (err) {
      failed++
      logger.error(
        {
          event: "CRON_TRAFFIC_SNAPSHOT_ERROR",
          stackId: stack.id,
          slug: stack.slug,
          date: date.toISOString(),
          error: err instanceof Error ? err.message : String(err),
        },
        "Failed to process daily traffic snapshot for stack"
      )
    }
  }

  return { processed, failed }
}

/**
 * Fetches unified traffic report (Daily, Monthly, Yearly) from database snapshots.
 */
export async function getAppTrafficReport(
  slug: string,
  params: {
    granularity?: "daily" | "monthly" | "yearly"
    date?: string
    month?: string
    year?: string
  }
): Promise<AppTrafficReportDTO> {
  const stack = await prisma.applicationStack.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true },
  })

  if (!stack) {
    throw new Error(`ApplicationStack with slug '${slug}' not found`)
  }

  const granularity = params.granularity ?? "daily"

  if (granularity === "daily") {
    let targetDate: Date
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      const [y, m, d] = params.date.split("-").map(Number)
      targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
    } else {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      targetDate = new Date(
        Date.UTC(
          yesterday.getUTCFullYear(),
          yesterday.getUTCMonth(),
          yesterday.getUTCDate(),
          0,
          0,
          0
        )
      )
    }

    const snapshot = await prisma.appHostingDailyTrafficSnapshot.findUnique({
      where: {
        stackId_date: {
          stackId: stack.id,
          date: targetDate,
        },
      },
    })

    const periodLabel = targetDate.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    })

    if (!snapshot) {
      return {
        granularity: "daily",
        periodLabel,
        date: targetDate.toISOString().slice(0, 10),
        totalRequests: 0,
        successRate: 100,
        avgLatencyMs: 0,
        totalBytes: 0,
        totalBytesFormatted: "0 B",
        trend: Array.from({ length: 24 }, (_, h) => ({
          label: `${String(h).padStart(2, "0")}:00`,
          requests: 0,
          errors: 0,
          visitors: 0,
          automated: 0,
          humanLike: 0,
        })),
        topPages: [],
        troubledPages: [],
        topIps: [],
        topCountries: [],
        audience: EMPTY_AUDIENCE,
        visitorEstimate: 0,
        visitorEstimateMethod: VISITOR_ESTIMATE_METHOD,
        requestQuality: computeRequestQuality(0, 0, 0, 0),
      }
    }

    const hourlyTrend =
      (snapshot.hourlyTrendJson as Array<{
        hour: number
        requests: number
        errors: number
        visitors?: number
        automated?: number
      }>) ?? []
    const trendMap = new Map<
      number,
      { requests: number; errors: number; visitors: number; automated: number }
    >()
    for (const item of hourlyTrend) {
      trendMap.set(item.hour, {
        requests: item.requests,
        errors: item.errors,
        visitors: item.visitors ?? 0,
        automated: item.automated ?? 0,
      })
    }

    const trend: TrafficTrendItem[] = Array.from({ length: 24 }, (_, h) => {
      const d = trendMap.get(h)
      const requests = d?.requests ?? 0
      const automated = d?.automated ?? 0
      return {
        label: `${String(h).padStart(2, "0")}:00`,
        requests,
        errors: d?.errors ?? 0,
        visitors: d?.visitors ?? 0,
        automated,
        humanLike: requests - automated,
      }
    })

    const totalRequests = snapshot.totalRequests
    const successRate =
      totalRequests > 0
        ? Math.round((snapshot.successCount / totalRequests) * 1000) / 10
        : 100

    const topIps = ((snapshot.topIpsJson as unknown as IpGeoInfo[]) ?? []).map(
      normalizeIpGeoInfo
    )
    const topCountries = computeTopCountries(topIps)

    return {
      granularity: "daily",
      periodLabel,
      date: targetDate.toISOString().slice(0, 10),
      totalRequests,
      successRate,
      avgLatencyMs: snapshot.avgLatencyMs,
      totalBytes: Number(snapshot.totalBytes),
      totalBytesFormatted: formatBytes(snapshot.totalBytes),
      trend,
      topPages: (snapshot.topPathsJson as unknown as TrafficPathCount[]) ?? [],
      troubledPages:
        (snapshot.errorPathsJson as unknown as TrafficErrorPath[]) ?? [],
      topIps,
      topCountries,
      audience: normalizeAudience(snapshot.audienceJson),
      visitorEstimate: snapshot.visitorEstimate,
      visitorEstimateMethod: snapshot.visitorEstMethod,
      requestQuality: computeRequestQuality(
        snapshot.status2xxCount,
        snapshot.status3xxCount,
        snapshot.status4xxCount,
        snapshot.status5xxCount
      ),
    }
  }

  if (granularity === "monthly") {
    let year: number
    let monthIndex: number // 0-11
    if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
      const [y, m] = params.month.split("-").map(Number)
      year = y
      monthIndex = m - 1
    } else {
      const now = new Date()
      year = now.getUTCFullYear()
      monthIndex = now.getUTCMonth()
    }

    const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0))
    const endOfMonth = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    )

    const snapshots = await prisma.appHostingDailyTrafficSnapshot.findMany({
      where: {
        stackId: stack.id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: "asc" },
    })

    const daysInMonth = endOfMonth.getUTCDate()
    const snapshotByDate = new Map<number, (typeof snapshots)[0]>()
    for (const snap of snapshots) {
      snapshotByDate.set(snap.date.getUTCDate(), snap)
    }

    let totalRequests = 0
    let totalSuccess = 0
    let totalErrors = 0
    let totalStatus2xx = 0
    let totalStatus3xx = 0
    let totalStatus4xx = 0
    let totalStatus5xx = 0
    let totalBytesBig = BigInt(0)
    let latencySum = 0
    let latencyCount = 0
    let totalVisitorEstimate = 0

    const pathViews = new Map<string, number>()
    const errorMap = new Map<string, { errors: number; sampleStatus: number }>()
    const ipMap = new Map<string, IpGeoInfo>()
    const audienceLists: TrafficAudienceBreakdown[] = []

    const trend: TrafficTrendItem[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const snap = snapshotByDate.get(day)
      const reqs = snap?.totalRequests ?? 0
      const errs = snap?.errorCount ?? 0
      const dayVisitors = snap?.visitorEstimate ?? 0
      const dayAutomated = snap?.automatedCount ?? 0
      trend.push({
        label: `${String(day).padStart(2, "0")}`,
        requests: reqs,
        errors: errs,
        // A day IS the natural cardinality scope here (unlike month/year
        // below), so this is the day's own real estimate, not a sum.
        visitors: dayVisitors,
        automated: dayAutomated,
        humanLike: reqs - dayAutomated,
      })

      if (snap) {
        totalRequests += snap.totalRequests
        totalSuccess += snap.successCount
        totalErrors += snap.errorCount
        totalStatus2xx += snap.status2xxCount ?? 0
        totalStatus3xx += snap.status3xxCount ?? 0
        totalStatus4xx += snap.status4xxCount ?? 0
        totalStatus5xx += snap.status5xxCount ?? 0
        totalBytesBig += snap.totalBytes
        // Summing daily cardinality estimates overcounts a visitor who
        // returns on multiple days within the month -- accepted, documented
        // approximation (visitorEstimateMethod already marks this as an
        // estimate; a true monthly cardinality would need re-querying
        // OpenSearch over the whole month instead of rolling up snapshots).
        totalVisitorEstimate += dayVisitors
        if (snap.avgLatencyMs > 0) {
          latencySum += snap.avgLatencyMs * snap.totalRequests
          latencyCount += snap.totalRequests
        }

        const topPaths =
          (snap.topPathsJson as unknown as TrafficPathCount[]) ?? []
        for (const p of topPaths) {
          pathViews.set(p.path, (pathViews.get(p.path) ?? 0) + p.views)
        }

        const errPaths =
          (snap.errorPathsJson as unknown as TrafficErrorPath[]) ?? []
        for (const e of errPaths) {
          const cur = errorMap.get(e.path)
          errorMap.set(e.path, {
            errors: (cur?.errors ?? 0) + e.errors,
            sampleStatus: e.sampleStatus ?? cur?.sampleStatus ?? 500,
          })
        }

        audienceLists.push(normalizeAudience(snap.audienceJson))

        const snapIps = ((snap.topIpsJson as unknown as IpGeoInfo[]) ?? []).map(
          normalizeIpGeoInfo
        )
        for (const ipItem of snapIps) {
          const cur = ipMap.get(ipItem.ip)
          if (cur) {
            cur.requestsCount += ipItem.requestsCount
            cur.status2xx += ipItem.status2xx
            cur.status3xx += ipItem.status3xx
            cur.status4xx += ipItem.status4xx
            cur.status5xx += ipItem.status5xx
            cur.successRatio = recomputeSuccessRatio(cur)
          } else {
            ipMap.set(ipItem.ip, { ...ipItem })
          }
        }
      }
    }

    const successRate =
      totalRequests > 0
        ? Math.round((totalSuccess / totalRequests) * 1000) / 10
        : 100
    const avgLatencyMs =
      latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0

    const sortedTopPages: TrafficPathCount[] = Array.from(pathViews.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)

    const sortedTroubledPages: TrafficErrorPath[] = Array.from(
      errorMap.entries()
    )
      .map(([path, val]) => ({
        path,
        errors: val.errors,
        sampleStatus: val.sampleStatus,
      }))
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 5)

    const topIps = Array.from(ipMap.values())
      .sort((a, b) => b.requestsCount - a.requestsCount)
      .slice(0, 10)

    const topCountries = computeTopCountries(topIps)

    const periodLabel = startOfMonth.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    })

    return {
      granularity: "monthly",
      periodLabel,
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      totalRequests,
      successRate,
      avgLatencyMs,
      totalBytes: Number(totalBytesBig),
      totalBytesFormatted: formatBytes(totalBytesBig),
      trend,
      topPages: sortedTopPages,
      troubledPages: sortedTroubledPages,
      topIps,
      topCountries,
      audience: mergeAudienceBreakdown(audienceLists),
      visitorEstimate: totalVisitorEstimate,
      visitorEstimateMethod: VISITOR_ESTIMATE_METHOD,
      requestQuality: computeRequestQuality(
        totalStatus2xx,
        totalStatus3xx,
        totalStatus4xx,
        totalStatus5xx
      ),
    }
  }

  // Yearly Granularity
  let targetYear = new Date().getUTCFullYear()
  if (params.year && /^\d{4}$/.test(params.year)) {
    targetYear = Number(params.year)
  }

  const startOfYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0))
  const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999))

  const snapshots = await prisma.appHostingDailyTrafficSnapshot.findMany({
    where: {
      stackId: stack.id,
      date: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
  })

  const monthBuckets = Array.from({ length: 12 }, () => ({
    requests: 0,
    errors: 0,
    bytes: BigInt(0),
    visitors: 0,
    automated: 0,
  }))

  let totalRequests = 0
  let totalSuccess = 0
  let totalStatus2xx = 0
  let totalStatus3xx = 0
  let totalStatus4xx = 0
  let totalStatus5xx = 0
  let totalBytesBig = BigInt(0)
  let latencySum = 0
  let latencyCount = 0
  let totalVisitorEstimate = 0

  const pathViews = new Map<string, number>()
  const errorMap = new Map<string, { errors: number; sampleStatus: number }>()
  const ipMap = new Map<string, IpGeoInfo>()
  const audienceLists: TrafficAudienceBreakdown[] = []

  for (const snap of snapshots) {
    const month = snap.date.getUTCMonth()
    monthBuckets[month].requests += snap.totalRequests
    monthBuckets[month].errors += snap.errorCount
    monthBuckets[month].bytes += snap.totalBytes
    // Same accepted sum-of-daily-estimates approximation as the monthly
    // view's period total -- see the comment there.
    monthBuckets[month].visitors += snap.visitorEstimate ?? 0
    monthBuckets[month].automated += snap.automatedCount ?? 0
    totalVisitorEstimate += snap.visitorEstimate ?? 0
    audienceLists.push(normalizeAudience(snap.audienceJson))

    totalRequests += snap.totalRequests
    totalSuccess += snap.successCount
    totalStatus2xx += snap.status2xxCount ?? 0
    totalStatus3xx += snap.status3xxCount ?? 0
    totalStatus4xx += snap.status4xxCount ?? 0
    totalStatus5xx += snap.status5xxCount ?? 0
    totalBytesBig += snap.totalBytes

    if (snap.avgLatencyMs > 0) {
      latencySum += snap.avgLatencyMs * snap.totalRequests
      latencyCount += snap.totalRequests
    }

    const topPaths = (snap.topPathsJson as unknown as TrafficPathCount[]) ?? []
    for (const p of topPaths) {
      pathViews.set(p.path, (pathViews.get(p.path) ?? 0) + p.views)
    }

    const errPaths =
      (snap.errorPathsJson as unknown as TrafficErrorPath[]) ?? []
    for (const e of errPaths) {
      const cur = errorMap.get(e.path)
      errorMap.set(e.path, {
        errors: (cur?.errors ?? 0) + e.errors,
        sampleStatus: e.sampleStatus ?? cur?.sampleStatus ?? 500,
      })
    }

    const snapIps = ((snap.topIpsJson as unknown as IpGeoInfo[]) ?? []).map(
      normalizeIpGeoInfo
    )
    for (const ipItem of snapIps) {
      const cur = ipMap.get(ipItem.ip)
      if (cur) {
        cur.requestsCount += ipItem.requestsCount
        cur.status2xx += ipItem.status2xx
        cur.status3xx += ipItem.status3xx
        cur.status4xx += ipItem.status4xx
        cur.status5xx += ipItem.status5xx
        cur.successRatio = recomputeSuccessRatio(cur)
      } else {
        ipMap.set(ipItem.ip, { ...ipItem })
      }
    }
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ]

  const trend: TrafficTrendItem[] = monthNames.map((name, idx) => ({
    label: name,
    requests: monthBuckets[idx].requests,
    errors: monthBuckets[idx].errors,
    visitors: monthBuckets[idx].visitors,
    automated: monthBuckets[idx].automated,
    humanLike: monthBuckets[idx].requests - monthBuckets[idx].automated,
  }))

  const successRate =
    totalRequests > 0
      ? Math.round((totalSuccess / totalRequests) * 1000) / 10
      : 100
  const avgLatencyMs =
    latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0

  const sortedTopPages: TrafficPathCount[] = Array.from(pathViews.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)

  const sortedTroubledPages: TrafficErrorPath[] = Array.from(errorMap.entries())
    .map(([path, val]) => ({
      path,
      errors: val.errors,
      sampleStatus: val.sampleStatus,
    }))
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 5)

  const topIps = Array.from(ipMap.values())
    .sort((a, b) => b.requestsCount - a.requestsCount)
    .slice(0, 10)

  const topCountries = computeTopCountries(topIps)

  return {
    granularity: "yearly",
    periodLabel: `Tahun ${targetYear}`,
    year: String(targetYear),
    totalRequests,
    successRate,
    avgLatencyMs,
    totalBytes: Number(totalBytesBig),
    totalBytesFormatted: formatBytes(totalBytesBig),
    trend,
    topPages: sortedTopPages,
    troubledPages: sortedTroubledPages,
    topIps,
    topCountries,
    audience: mergeAudienceBreakdown(audienceLists),
    visitorEstimate: totalVisitorEstimate,
    visitorEstimateMethod: VISITOR_ESTIMATE_METHOD,
    requestQuality: computeRequestQuality(
      totalStatus2xx,
      totalStatus3xx,
      totalStatus4xx,
      totalStatus5xx
    ),
  }
}

/**
 * Fetches micro-batch of recent live ingress requests for real-time inspection.
 * Bound to 25 items max.
 */
export async function getLiveTrafficLogs(
  slug: string,
  options?: {
    limit?: number
    since?: string
    status?: "all" | "2xx" | "4xx" | "5xx"
  },
  injectedClient?: Client
): Promise<AppTrafficLogsDTO> {
  const {
    client: resolvedClient,
    stack,
    domainList,
  } = await resolveOpenSearchForStack(slug)
  const client = injectedClient ?? resolvedClient
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 50)
  const filterClauses: Record<string, unknown>[] = [
    buildStackFilterClause(domainList, stack.slug),
  ]
  if (options?.since) {
    filterClauses.push({
      range: { "@timestamp": { gt: options.since } },
    })
  }

  if (options?.status === "2xx") {
    filterClauses.push({ range: { http_status: { gte: 200, lt: 300 } } })
  } else if (options?.status === "4xx") {
    filterClauses.push({ range: { http_status: { gte: 400, lt: 500 } } })
  } else if (options?.status === "5xx") {
    filterClauses.push({ range: { http_status: { gte: 500, lt: 600 } } })
  }

  const searchPayload: Record<string, unknown> = {
    size: limit,
    query: {
      bool: {
        filter: filterClauses,
      },
    },
    sort: [{ "@timestamp": { order: "desc" } }],
  }

  try {
    const rawClient = client as unknown as {
      search: (
        params: Record<string, unknown>
      ) => Promise<Record<string, unknown>>
    }
    const res = await rawClient.search({
      index: "haproxy-controller-*",
      body: searchPayload,
    })
    const rawRes = res as unknown as {
      body?: {
        hits?: {
          hits?: Array<{ _id: string; _source?: Record<string, unknown> }>
          total?: number | { value: number }
        }
      }
      hits?: {
        hits?: Array<{ _id: string; _source?: Record<string, unknown> }>
        total?: number | { value: number }
      }
    }
    const rawHits = rawRes.body?.hits?.hits ?? rawRes.hits?.hits ?? []
    const rawTotal = rawRes.body?.hits?.total ?? rawRes.hits?.total
    const total =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "object" &&
            rawTotal !== null &&
            "value" in rawTotal
          ? rawTotal.value
          : 0

    const logs: AppTrafficLogItemDTO[] = rawHits.map((h) => ({
      id: h._id,
      timestamp: String(h._source?.["@timestamp"] ?? new Date().toISOString()),
      method: String(h._source?.http_method ?? "GET"),
      path: String(h._source?.http_path ?? "/"),
      statusCode: Number(h._source?.http_status ?? 200),
      latencyMs: Number(h._source?.response_time_ms ?? 0),
      bytes: Number(h._source?.bytes_read ?? 0),
      clientIp: String(h._source?.client_ip ?? "-"),
    }))

    return { logs, total }
  } catch (err) {
    logger.warn(
      {
        event: "FETCH_LIVE_LOGS_FAILED",
        slug,
        error: err instanceof Error ? err.message : String(err),
      },
      "Failed to fetch live ingress logs from OpenSearch"
    )
    return { logs: [], total: 0 }
  }
}
