import { prisma } from "@/lib/prisma"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import type { AnalyticsGranularity } from "@/lib/whatsapp/meta-cloud/types/analytics"
import type {
  SyncAnalyticsInput,
  AnalyticsSyncResult,
  ComparisonRow,
  AnalyticsReport,
  CostReconciliationRow,
  CostReconciliationReport,
} from "./analytics.types"

const DISCREPANCY_THRESHOLD = 0.05
// ponytail: 5% threshold, configurable when orgs need different tolerances

export class AnalyticsService {
  /**
   * Sync Meta analytics for a device + date range.
   * Pulls from Meta API, upserts local DailyCount rows,
   * and returns discrepancies found.
   */
  async syncAnalytics(input: SyncAnalyticsInput): Promise<AnalyticsSyncResult> {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id: input.deviceId },
    })
    if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")
    if (device.organizationId !== input.organizationId) {
      throw new Error("DEVICE_NOT_OWNED")
    }
    if (!device.tokenEncrypted || !device.whatsappPhoneId || !device.whatsappBusinessAccountId) {
      throw new Error("WHATSAPP_DEVICE_NOT_CONFIGURED")
    }

    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted,
      phoneNumberId: device.whatsappPhoneId,
      wabaId: device.whatsappBusinessAccountId,
      organizationId: input.organizationId,
    })

    const startTs = Math.floor(new Date(input.startDate).getTime() / 1000)
    const endTs = Math.floor(new Date(input.endDate + "T23:59:59Z").getTime() / 1000)
    const granularity = (input.granularity ?? "DAY") as AnalyticsGranularity

    const result = await client.getAnalytics({
      start: startTs,
      end: endTs,
      granularity,
      metric_types: "CONVERSATION",
    })

    const discrepancies: ComparisonRow[] = []
    let syncedCount = 0

    for (const item of result.data) {
      const date = item.conversation_start
        ? new Date(item.conversation_start * 1000).toISOString().split("T")[0]
        : input.startDate

      const metaInbound = item.message_inbound_count ?? 0
      const metaOutbound = item.message_outbound_count ?? 0

      // Get pre-sync value in one query
      const existing = await prisma.whatsappDailyCount.findFirst({
        where: {
          organizationId: input.organizationId,
          date: new Date(date),
          whatsappDeviceId: input.deviceId,
        },
      })

      const preInbound = existing?.messageInboxCount ?? 0
      const preOutbound = existing?.messageOutboxCount ?? 0

      // Upsert with new totals (not increment — replace)
      if (existing) {
        await prisma.whatsappDailyCount.update({
          where: { id: existing.id },
          data: {
            messageInboxCount: preInbound + metaInbound,
            messageOutboxCount: preOutbound + metaOutbound,
          },
        })
      } else {
        await prisma.whatsappDailyCount.create({
          data: {
            organizationId: input.organizationId,
            date: new Date(date),
            whatsappDeviceId: input.deviceId,
            messageInboxCount: metaInbound,
            messageOutboxCount: metaOutbound,
            sessionCount: 0,
            messageFailedCount: 0,
          },
        })
      }

      // Check discrepancy against pre-sync values (not post-updated)
      if (Math.abs(metaInbound - preInbound) / Math.max(metaInbound, 1) > DISCREPANCY_THRESHOLD) {
        discrepancies.push({
          date,
          phoneNumberId: item.phone_number_id,
          metric: "message_inbound",
          metaValue: metaInbound,
          localValue: preInbound,
          delta: metaInbound - preInbound,
          deltaPercent: (metaInbound - preInbound) / Math.max(metaInbound, 1),
        })
      }

      if (Math.abs(metaOutbound - preOutbound) / Math.max(metaOutbound, 1) > DISCREPANCY_THRESHOLD) {
        discrepancies.push({
          date,
          phoneNumberId: item.phone_number_id,
          metric: "message_outbound",
          metaValue: metaOutbound,
          localValue: preOutbound,
          delta: metaOutbound - preOutbound,
          deltaPercent: (metaOutbound - preOutbound) / Math.max(metaOutbound, 1),
        })
      }

      syncedCount++
    }

    return { syncedCount, discrepancies }
  }

  /**
   * Generate a comparison report — Meta vs local counts side by side.
   */
  async getComparisonReport(
    organizationId: string,
    deviceId: string,
    startDate: string,
    endDate: string
  ): Promise<AnalyticsReport> {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id: deviceId },
    })
    if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")
    if (device.organizationId !== organizationId) throw new Error("DEVICE_NOT_OWNED")

    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted ?? "",
      phoneNumberId: device.whatsappPhoneId ?? "",
      wabaId: device.whatsappBusinessAccountId ?? "",
      organizationId,
    })

    const startTs = Math.floor(new Date(startDate).getTime() / 1000)
    const endTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000)

    const metaResult = await client.getAnalytics({
      start: startTs,
      end: endTs,
      granularity: "DAY",
      metric_types: "CONVERSATION",
    })

    const localRows = await prisma.whatsappDailyCount.findMany({
      where: {
        organizationId,
        whatsappDeviceId: deviceId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate + "T23:59:59Z"),
        },
      },
      orderBy: { date: "asc" },
    })

    const localByDate = new Map<string, typeof localRows[0]>()
    for (const row of localRows) {
      const key = row.date.toISOString().split("T")[0]
      localByDate.set(key, row)
    }

    const comparisons: ComparisonRow[] = []
    let totalMeta = 0
    let totalLocal = 0

    for (const item of metaResult.data) {
      const date = item.conversation_start
        ? new Date(item.conversation_start * 1000).toISOString().split("T")[0]
        : startDate

      const metaInbound = item.message_inbound_count ?? 0
      const metaOutbound = item.message_outbound_count ?? 0
      const local = localByDate.get(date)

      const localInbound = local?.messageInboxCount ?? 0
      const localOutbound = local?.messageOutboxCount ?? 0

      const inboundDelta = metaInbound - localInbound
      const outboundDelta = metaOutbound - localOutbound

      comparisons.push({
        date,
        phoneNumberId: item.phone_number_id,
        metric: "inbound",
        metaValue: metaInbound,
        localValue: localInbound,
        delta: inboundDelta,
        deltaPercent: metaInbound > 0 ? inboundDelta / metaInbound : 0,
      })
      comparisons.push({
        date,
        phoneNumberId: item.phone_number_id,
        metric: "outbound",
        metaValue: metaOutbound,
        localValue: localOutbound,
        delta: outboundDelta,
        deltaPercent: metaOutbound > 0 ? outboundDelta / metaOutbound : 0,
      })

      totalMeta += metaInbound + metaOutbound
      totalLocal += localInbound + localOutbound
    }

    const totalDelta = totalMeta - totalLocal
    const rowsWithDiscrepancy = comparisons.filter(
      (c) => Math.abs(c.deltaPercent) > DISCREPANCY_THRESHOLD
    ).length

    return {
      from: startDate,
      to: endDate,
      deviceId,
      comparisons,
      summary: { totalMeta, totalLocal, totalDelta, rowsWithDiscrepancy },
    }
  }

  /**
   * Backfill missing local data from Meta analytics.
   * Creates records for dates where Meta has data but local DB doesn't.
   */
  async backfillMissingData(
    organizationId: string,
    deviceId: string,
    date: string
  ): Promise<{ created: number }> {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id: deviceId },
    })
    if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")

    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted ?? "",
      phoneNumberId: device.whatsappPhoneId ?? "",
      wabaId: device.whatsappBusinessAccountId ?? "",
      organizationId,
    })

    const startTs = Math.floor(new Date(date).getTime() / 1000)
    const endTs = startTs + 86400

    const result = await client.getAnalytics({
      start: startTs,
      end: endTs,
      granularity: "DAY",
      metric_types: "CONVERSATION",
    })

    let created = 0
    for (const item of result.data) {
      const existing = await prisma.whatsappDailyCount.findFirst({
        where: {
          organizationId,
          date: new Date(date),
          whatsappDeviceId: deviceId,
        },
      })
      if (existing) continue

      await prisma.whatsappDailyCount.create({
        data: {
          organizationId,
          date: new Date(date),
          whatsappDeviceId: deviceId,
          messageInboxCount: item.message_inbound_count ?? 0,
          messageOutboxCount: item.message_outbound_count ?? 0,
          sessionCount: 0,
          messageFailedCount: 0,
        },
      })
      created++
    }

    return { created }
  }

  /**
   * Cost reconciliation — Meta reported cost vs local billing ledger.
   */
  async getCostReconciliation(
    organizationId: string,
    opts: { deviceId?: string; startDate: string; endDate: string }
  ): Promise<CostReconciliationReport> {
    const localLedger = await prisma.whatsappBillingLedger.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(opts.startDate),
          lte: new Date(opts.endDate + "T23:59:59Z"),
        },
        ...(opts.deviceId ? { whatsappDeviceId: opts.deviceId } : {}),
      },
    })

    const deviceWhere: Record<string, unknown> = { organizationId }
    if (opts.deviceId) deviceWhere.id = opts.deviceId

    const devices = await prisma.whatsappDevice.findMany({
      where: deviceWhere,
      select: {
        id: true,
        whatsappBusinessAccountId: true,
        tokenEncrypted: true,
        whatsappPhoneId: true,
      },
    })

    const deviceResults = await Promise.all(
      devices
        .filter((d) => d.whatsappBusinessAccountId && d.tokenEncrypted)
        .map(async (device) => {
          const client = await WhatsAppDeviceClient.fromDevice({
            accessToken: device.tokenEncrypted!,
            phoneNumberId: device.whatsappPhoneId ?? "",
            wabaId: device.whatsappBusinessAccountId!,
            organizationId,
          })

          const startTs = Math.floor(new Date(opts.startDate).getTime() / 1000)
          const endTs = Math.floor(new Date(opts.endDate + "T23:59:59Z").getTime() / 1000)

          const metaResult = await client.getAnalytics({
            start: startTs,
            end: endTs,
            granularity: "DAY",
            metric_types: "PRICING",
          })

          const rows: CostReconciliationRow[] = []
          let deviceMetaCost = 0
          let deviceLocalCost = 0

          for (const item of metaResult.data) {
            const date = item.conversation_start
              ? new Date(item.conversation_start * 1000).toISOString().split("T")[0]
              : opts.startDate

            const metaCost = item.cost?.amount ?? 0
            const localForDevice = localLedger
              .filter((l) => l.whatsappDeviceId === device.id && l.pricingCategory === item.conversation_category)
              .reduce((sum, l) => sum + Number(l.quotaValue), 0)

            rows.push({
              phoneNumberId: item.phone_number_id,
              conversationCategory: item.conversation_category,
              date,
              metaCost,
              localCost: localForDevice,
              delta: metaCost - localForDevice,
              currency: item.cost?.currency ?? "USD",
            })

            deviceMetaCost += metaCost
            deviceLocalCost += localForDevice
          }

          return { rows, deviceMetaCost, deviceLocalCost }
        })
    )

    const rows: CostReconciliationRow[] = []
    let totalMetaCost = 0
    let totalLocalCost = 0
    for (const dr of deviceResults) {
      if (!dr) continue
      rows.push(...dr.rows)
      totalMetaCost += dr.deviceMetaCost
      totalLocalCost += dr.deviceLocalCost
    }

    return {
      rows,
      totalMetaCost,
      totalLocalCost,
      totalDelta: totalMetaCost - totalLocalCost,
    }
  }
}

export const analyticsService = new AnalyticsService()
