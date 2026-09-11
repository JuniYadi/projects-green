import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { logger } from "@/lib/logger"
import { resolveOpenSearchForStack } from "./opensearch-traffic.service"
import type {
  AppLogReportDTO,
  HourlyLogAggregationResult,
  HourlyRollupWindow,
  LogErrorSignature,
  LogHourlyTrendItem,
} from "./opensearch-log-health.types"

/**
 * Calculates the exact UTC hour window for hourly rollup.
 * Deterministically binds date to windowStart so midnight (00:05 UTC)
 * cleanly resolves to yesterday (T-1) hour 23 without shifting forward.
 */
export function getHourlyRollupWindow(
  referenceTime = new Date()
): HourlyRollupWindow {
  const prevHourEpoch = referenceTime.getTime() - 60 * 60 * 1000
  const d = new Date(prevHourEpoch)

  const windowStart = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      0,
      0,
      0
    )
  )
  const windowEnd = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      59,
      59,
      999
    )
  )

  const targetDate = new Date(
    Date.UTC(
      windowStart.getUTCFullYear(),
      windowStart.getUTCMonth(),
      windowStart.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )
  const targetHour = windowStart.getUTCHours()

  return { windowStart, windowEnd, targetDate, targetHour }
}

/**
 * Normalizes and truncates error message into a stable signature.
 */
export function extractErrorSignature(rawMessage: string): string {
  const clean = rawMessage.replace(/\u001b\[[0-9;]*[mK]/g, "").trim()
  const firstLine = clean.split("\n")[0]?.trim() ?? "Error"
  return firstLine.slice(0, 120)
}

/**
 * Computes hourly log aggregation directly from OpenSearch with pod isolation.
 */
export async function computeHourlyLogAggregation(
  stackIdOrSlug: string,
  window: HourlyRollupWindow,
  injectedClient?: unknown
): Promise<HourlyLogAggregationResult> {
  let client: unknown
  let stackSlug: string
  let stackId: string

  if (injectedClient) {
    const s = await prisma.applicationStack.findFirst({
      where: { OR: [{ id: stackIdOrSlug }, { slug: stackIdOrSlug }] },
      select: { id: true, slug: true },
    })
    if (!s) {
      throw new Error(`ApplicationStack not found: ${stackIdOrSlug}`)
    }
    client = injectedClient
    stackSlug = s.slug
    stackId = s.id
  } else {
    const resolved = await resolveOpenSearchForStack(stackIdOrSlug)
    client = resolved.client
    stackSlug = resolved.stack.slug
    stackId = resolved.stack.id
  }

  const queryPayload = {
    size: 0,
    query: {
      bool: {
        filter: [
          {
            range: {
              "@timestamp": {
                gte: window.windowStart.toISOString(),
                lte: window.windowEnd.toISOString(),
              },
            },
          },
          {
            bool: {
              should: [
                {
                  wildcard: { "kubernetes.pod_name.keyword": `*${stackSlug}*` },
                },
                { wildcard: { "kubernetes.pod_name": `*${stackSlug}*` } },
                {
                  term: {
                    "kubernetes.labels.app\\.kubernetes\\.io/instance.keyword":
                      stackSlug,
                  },
                },
                {
                  term: {
                    "kubernetes.labels.app\\.kubernetes\\.io/name.keyword":
                      stackSlug,
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
        ],
      },
    },
    aggs: {
      streams: {
        terms: { field: "stream.keyword", size: 5 },
      },
      levels: {
        terms: { field: "level", size: 10 },
      },
      errors: {
        filter: {
          bool: {
            should: [
              { term: { "stream.keyword": "stderr" } },
              { range: { level: { gte: 50 } } },
              { wildcard: { message: "*ERROR*" } },
              { wildcard: { message: "*error*" } },
              { wildcard: { message: "*Exception*" } },
            ],
            minimum_should_match: 1,
          },
        },
        aggs: {
          top_messages: {
            terms: { field: "message.keyword", size: 5 },
          },
        },
      },
    },
  }

  let totalLogs = 0
  let infoCount = 0
  let warnCount = 0
  let errorCount = 0
  const topErrors: LogErrorSignature[] = []

  try {
    const rawClient = client as {
      search: (p: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const res = await rawClient.search({
      index: "app-*",
      body: queryPayload,
    })

    const rawRes = res as {
      body?: {
        hits?: { total?: number | { value: number } }
        aggregations?: Record<string, unknown>
      }
      hits?: { total?: number | { value: number } }
      aggregations?: Record<string, unknown>
    }

    const rawTotal = rawRes.body?.hits?.total ?? rawRes.hits?.total
    totalLogs =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "object" &&
            rawTotal !== null &&
            "value" in rawTotal
          ? rawTotal.value
          : 0

    const aggs = (rawRes.body?.aggregations ?? rawRes.aggregations ?? {}) as {
      streams?: { buckets: Array<{ key: string; doc_count: number }> }
      levels?: { buckets: Array<{ key: number; doc_count: number }> }
      errors?: {
        doc_count: number
        top_messages?: { buckets: Array<{ key: string; doc_count: number }> }
      }
    }

    errorCount = aggs.errors?.doc_count ?? 0

    // Approximate warn vs info
    if (aggs.levels?.buckets) {
      for (const b of aggs.levels.buckets) {
        if (b.key === 40) warnCount += b.doc_count
      }
    }

    infoCount = Math.max(totalLogs - errorCount - warnCount, 0)

    const msgBuckets = aggs.errors?.top_messages?.buckets ?? []
    for (const b of msgBuckets) {
      topErrors.push({
        signature: extractErrorSignature(b.key),
        count: b.doc_count,
        sampleMessage: b.key.slice(0, 200),
      })
    }
  } catch (err) {
    logger.warn(
      {
        event: "HOURLY_LOG_AGGREGATION_FAILED",
        stackId,
        slug: stackSlug,
        windowStart: window.windowStart.toISOString(),
        error: err instanceof Error ? err.message : String(err),
      },
      "Failed to compute hourly log aggregation from OpenSearch"
    )
  }

  return {
    stackId,
    slug: stackSlug,
    window,
    totalLogs,
    infoCount,
    warnCount,
    errorCount,
    topErrors,
  }
}

/**
 * Merges hourly result into the single daily snapshot record (Accumulator Pattern).
 */
export async function accumulateHourlyLogSnapshot(
  result: HourlyLogAggregationResult
): Promise<void> {
  const existing = await prisma.appHostingDailyLogSnapshot.findUnique({
    where: {
      stackId_date: {
        stackId: result.stackId,
        date: result.window.targetDate,
      },
    },
  })

  // Initialize or load 24 slots
  let hourlyTrend: LogHourlyTrendItem[] = existing?.hourlyTrendJson
    ? (existing.hourlyTrendJson as unknown as LogHourlyTrendItem[])
    : Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        info: 0,
        warn: 0,
        error: 0,
      }))

  if (hourlyTrend.length < 24) {
    hourlyTrend = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      info: 0,
      warn: 0,
      error: 0,
    }))
  }

  // Idempotent replace for this target hour
  hourlyTrend[result.window.targetHour] = {
    hour: result.window.targetHour,
    info: result.infoCount,
    warn: result.warnCount,
    error: result.errorCount,
  }

  // Recalculate daily totals from all 24 slots
  let totalLogs = 0
  let infoCount = 0
  let warnCount = 0
  let errorCount = 0

  for (const slot of hourlyTrend) {
    totalLogs += slot.info + slot.warn + slot.error
    infoCount += slot.info
    warnCount += slot.warn
    errorCount += slot.error
  }

  const healthScore =
    totalLogs > 0
      ? Math.max(Math.round(((totalLogs - errorCount) / totalLogs) * 100), 0)
      : 100

  // Merge top error signatures (keep top 10)
  const existingErrors: LogErrorSignature[] = existing?.topErrorsJson
    ? (existing.topErrorsJson as unknown as LogErrorSignature[])
    : []

  const errorMap = new Map<string, LogErrorSignature>()
  for (const err of existingErrors) {
    errorMap.set(err.signature, err)
  }
  for (const err of result.topErrors) {
    const cur = errorMap.get(err.signature)
    errorMap.set(err.signature, {
      signature: err.signature,
      count: (cur?.count ?? 0) + err.count,
      sampleMessage: err.sampleMessage,
    })
  }

  const topErrors = Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  await prisma.appHostingDailyLogSnapshot.upsert({
    where: {
      stackId_date: {
        stackId: result.stackId,
        date: result.window.targetDate,
      },
    },
    update: {
      totalLogs,
      infoCount,
      warnCount,
      errorCount,
      healthScore,
      hourlyTrendJson: hourlyTrend as unknown as Prisma.InputJsonValue,
      topErrorsJson: topErrors as unknown as Prisma.InputJsonValue,
    },
    create: {
      stackId: result.stackId,
      date: result.window.targetDate,
      totalLogs,
      infoCount,
      warnCount,
      errorCount,
      healthScore,
      hourlyTrendJson: hourlyTrend as unknown as Prisma.InputJsonValue,
      topErrorsJson: topErrors as unknown as Prisma.InputJsonValue,
    },
  })
}

/**
 * Cron execution handler for hourly log rollup.
 * Runs at 5 minutes past the hour (`5 * * * *`).
 */
export async function processHourlyLogRollupJob(referenceTime?: Date): Promise<{
  processed: number
  failed: number
}> {
  const window = getHourlyRollupWindow(referenceTime)

  const stacks = await prisma.applicationStack.findMany({
    where: { status: "RUNNING" },
    select: { id: true, slug: true },
  })

  let processed = 0
  let failed = 0

  for (const stack of stacks) {
    try {
      const agg = await computeHourlyLogAggregation(stack.id, window)
      await accumulateHourlyLogSnapshot(agg)
      processed++
    } catch (err) {
      failed++
      logger.error(
        {
          event: "HOURLY_ROLLUP_JOB_STACK_FAILED",
          stackId: stack.id,
          slug: stack.slug,
          window: window.windowStart.toISOString(),
          error: err instanceof Error ? err.message : String(err),
        },
        "Failed to process hourly log rollup for stack"
      )
    }
  }

  return { processed, failed }
}

/**
 * Unified Log Health Report Service (Daily, Monthly, Yearly).
 */
export async function getAppLogReport(
  slug: string,
  params: {
    granularity?: "daily" | "monthly" | "yearly"
    date?: string
    month?: string
    year?: string
  }
): Promise<AppLogReportDTO> {
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
      const now = new Date()
      targetDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0
        )
      )
    }

    const snapshot = await prisma.appHostingDailyLogSnapshot.findUnique({
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
        totalLogs: 0,
        infoCount: 0,
        warnCount: 0,
        errorCount: 0,
        healthScore: 100,
        trend: Array.from({ length: 24 }, (_, h) => ({
          label: `${String(h).padStart(2, "0")}:00`,
          info: 0,
          warn: 0,
          error: 0,
        })),
        topErrors: [],
      }
    }

    const hourlyTrend =
      (snapshot.hourlyTrendJson as unknown as LogHourlyTrendItem[]) ?? []
    const trendMap = new Map<number, LogHourlyTrendItem>()
    for (const item of hourlyTrend) {
      trendMap.set(item.hour, item)
    }

    const trend = Array.from({ length: 24 }, (_, h) => {
      const d = trendMap.get(h)
      return {
        label: `${String(h).padStart(2, "0")}:00`,
        info: d?.info ?? 0,
        warn: d?.warn ?? 0,
        error: d?.error ?? 0,
      }
    })

    return {
      granularity: "daily",
      periodLabel,
      date: targetDate.toISOString().slice(0, 10),
      totalLogs: snapshot.totalLogs,
      infoCount: snapshot.infoCount,
      warnCount: snapshot.warnCount,
      errorCount: snapshot.errorCount,
      healthScore: snapshot.healthScore,
      trend,
      topErrors:
        (snapshot.topErrorsJson as unknown as LogErrorSignature[]) ?? [],
    }
  }

  if (granularity === "monthly") {
    let year: number
    let monthIndex: number
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

    const snapshots = await prisma.appHostingDailyLogSnapshot.findMany({
      where: {
        stackId: stack.id,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { date: "asc" },
    })

    const daysInMonth = endOfMonth.getUTCDate()
    const snapshotByDay = new Map<number, (typeof snapshots)[0]>()
    for (const s of snapshots) {
      snapshotByDay.set(s.date.getUTCDate(), s)
    }

    let totalLogs = 0
    let infoCount = 0
    let warnCount = 0
    let errorCount = 0
    const errorMap = new Map<string, LogErrorSignature>()
    const trend: Array<{
      label: string
      info: number
      warn: number
      error: number
    }> = []

    for (let day = 1; day <= daysInMonth; day++) {
      const snap = snapshotByDay.get(day)
      trend.push({
        label: `${String(day).padStart(2, "0")}`,
        info: snap?.infoCount ?? 0,
        warn: snap?.warnCount ?? 0,
        error: snap?.errorCount ?? 0,
      })

      if (snap) {
        totalLogs += snap.totalLogs
        infoCount += snap.infoCount
        warnCount += snap.warnCount
        errorCount += snap.errorCount

        const errs =
          (snap.topErrorsJson as unknown as LogErrorSignature[]) ?? []
        for (const e of errs) {
          const cur = errorMap.get(e.signature)
          errorMap.set(e.signature, {
            signature: e.signature,
            count: (cur?.count ?? 0) + e.count,
            sampleMessage: e.sampleMessage,
          })
        }
      }
    }

    const healthScore =
      totalLogs > 0
        ? Math.max(Math.round(((totalLogs - errorCount) / totalLogs) * 100), 0)
        : 100

    const topErrors = Array.from(errorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const periodLabel = startOfMonth.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    })

    return {
      granularity: "monthly",
      periodLabel,
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      totalLogs,
      infoCount,
      warnCount,
      errorCount,
      healthScore,
      trend,
      topErrors,
    }
  }

  // Yearly Granularity
  let targetYear = new Date().getUTCFullYear()
  if (params.year && /^\d{4}$/.test(params.year)) {
    targetYear = Number(params.year)
  }

  const startOfYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0))
  const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999))

  const snapshots = await prisma.appHostingDailyLogSnapshot.findMany({
    where: {
      stackId: stack.id,
      date: { gte: startOfYear, lte: endOfYear },
    },
  })

  const monthBuckets = Array.from({ length: 12 }, () => ({
    info: 0,
    warn: 0,
    error: 0,
  }))

  let totalLogs = 0
  let infoCount = 0
  let warnCount = 0
  let errorCount = 0
  const errorMap = new Map<string, LogErrorSignature>()

  for (const s of snapshots) {
    const m = s.date.getUTCMonth()
    monthBuckets[m].info += s.infoCount
    monthBuckets[m].warn += s.warnCount
    monthBuckets[m].error += s.errorCount

    totalLogs += s.totalLogs
    infoCount += s.infoCount
    warnCount += s.warnCount
    errorCount += s.errorCount

    const errs = (s.topErrorsJson as unknown as LogErrorSignature[]) ?? []
    for (const e of errs) {
      const cur = errorMap.get(e.signature)
      errorMap.set(e.signature, {
        signature: e.signature,
        count: (cur?.count ?? 0) + e.count,
        sampleMessage: e.sampleMessage,
      })
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

  const trend = monthNames.map((name, idx) => ({
    label: name,
    info: monthBuckets[idx].info,
    warn: monthBuckets[idx].warn,
    error: monthBuckets[idx].error,
  }))

  const healthScore =
    totalLogs > 0
      ? Math.max(Math.round(((totalLogs - errorCount) / totalLogs) * 100), 0)
      : 100

  const topErrors = Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    granularity: "yearly",
    periodLabel: `Tahun ${targetYear}`,
    year: String(targetYear),
    totalLogs,
    infoCount,
    warnCount,
    errorCount,
    healthScore,
    trend,
    topErrors,
  }
}

/**
 * On-Demand Deep Error Drilldown directly from OpenSearch (Beyond Top 10).
 */
export async function getAppLogErrorsDrilldown(
  slug: string,
  options?: {
    from?: string
    to?: string
    limit?: number
  },
  injectedClient?: unknown
): Promise<{
  errors: LogErrorSignature[]
  totalDistinct: number
}> {
  let client: unknown
  let stackSlug: string

  if (injectedClient) {
    const s = await prisma.applicationStack.findFirst({
      where: { slug },
      select: { id: true, slug: true },
    })
    if (!s) throw new Error(`Stack not found: ${slug}`)
    client = injectedClient
    stackSlug = s.slug
  } else {
    const resolved = await resolveOpenSearchForStack(slug)
    client = resolved.client
    stackSlug = resolved.stack.slug
  }

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)
  const filterClauses: Record<string, unknown>[] = [
    {
      bool: {
        should: [
          { wildcard: { "kubernetes.pod_name.keyword": `*${stackSlug}*` } },
          { wildcard: { "kubernetes.pod_name": `*${stackSlug}*` } },
          {
            term: {
              "kubernetes.labels.app\\.kubernetes\\.io/instance.keyword":
                stackSlug,
            },
          },
          {
            term: {
              "kubernetes.labels.app\\.kubernetes\\.io/name.keyword": stackSlug,
            },
          },
        ],
        minimum_should_match: 1,
      },
    },
    {
      bool: {
        should: [
          { term: { "stream.keyword": "stderr" } },
          { range: { level: { gte: 50 } } },
          { wildcard: { message: "*ERROR*" } },
          { wildcard: { message: "*error*" } },
          { wildcard: { message: "*Exception*" } },
        ],
        minimum_should_match: 1,
      },
    },
  ]

  if (options?.from || options?.to) {
    const range: Record<string, string> = {}
    if (options.from) range.gte = options.from
    if (options.to) range.lte = options.to
    filterClauses.push({ range: { "@timestamp": range } })
  }

  try {
    const rawClient = client as {
      search: (p: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const res = await rawClient.search({
      index: "app-*",
      body: {
        size: 0,
        query: { bool: { filter: filterClauses } },
        aggs: {
          error_messages: {
            terms: { field: "message.keyword", size: limit },
          },
        },
      },
    })

    const rawRes = res as {
      body?: {
        aggregations?: {
          error_messages?: {
            buckets: Array<{ key: string; doc_count: number }>
          }
        }
      }
      aggregations?: {
        error_messages?: { buckets: Array<{ key: string; doc_count: number }> }
      }
    }

    const buckets =
      rawRes.body?.aggregations?.error_messages?.buckets ??
      rawRes.aggregations?.error_messages?.buckets ??
      []

    const errors: LogErrorSignature[] = buckets.map((b) => ({
      signature: extractErrorSignature(b.key),
      count: b.doc_count,
      sampleMessage: b.key.slice(0, 300),
    }))

    return {
      errors,
      totalDistinct: errors.length,
    }
  } catch (err) {
    logger.warn(
      {
        event: "ON_DEMAND_ERROR_DRILLDOWN_FAILED",
        slug,
        error: err instanceof Error ? err.message : String(err),
      },
      "Failed on-demand error drilldown from OpenSearch"
    )
    return { errors: [], totalDistinct: 0 }
  }
}
