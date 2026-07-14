import { Prisma } from "@prisma/client"

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export type WhatsappDailyCountDTO = Pick<
  Prisma.WhatsappDailyCountGetPayload<Prisma.WhatsappDailyCountDefaultArgs>,
  | "id"
  | "organizationId"
  | "date"
  | "sessionCount"
  | "messageInboxCount"
  | "messageOutboxCount"
  | "messageFailedCount"
  | "whatsappDeviceId"
>

export type WhatsappMonthlyCountDTO = Pick<
  Prisma.WhatsappMonthlyCountGetPayload<Prisma.WhatsappMonthlyCountDefaultArgs>,
  | "id"
  | "organizationId"
  | "year"
  | "month"
  | "sessionCount"
  | "messageInboxCount"
  | "messageOutboxCount"
  | "messageFailedCount"
  | "whatsappDeviceId"
>

export type BillingCostDTO = Pick<
  Prisma.BillingUsageLedgerGetPayload<Prisma.BillingUsageLedgerDefaultArgs>,
  "id" | "organizationId" | "period" | "category" | "amountIdr" | "metadata"
>

export type CategoryBreakdownDTO = {
  category: string
  count: number
  totalCost: number
}

export type DeviceUsageSummaryDTO = {
  deviceId: string | null
  phoneNumber: string | null
  messageInboxCount: number
  messageOutboxCount: number
  sessionCount: number
  messageFailedCount: number
}

export type CostSummaryDTO = {
  totalAmount: number
  totalEntries: number
  byCategory: CategoryBreakdownDTO[]
}

export type UsageOverviewDTO = {
  month: WhatsappMonthlyCountDTO[]
  today: WhatsappDailyCountDTO[]
  cost: CostSummaryDTO
  devices: DeviceUsageSummaryDTO[]
}

// ─── Cost Breakdown DTOs ───────────────────────────────────────────────────────

export type DeviceCostBreakdownDTO = {
  deviceId: string
  phoneNumber: string | null
  totalCost: number
  byCategory: CategoryBreakdownDTO[]
  messageCount: number
  quotaBase: number          // default monthly quota
  quotaBaseOut: number       // default remaining
  addonQuota: number         // addon remaining
  addonQuotaTotal: number    // addon purchased
  quotaUsed: number          // default used + addon used
  quotaPercent: number
}

export type CostBreakdownResponseDTO = {
  period: string
  totalCost: number
  projectedCost: number
  forecast: {
    daysElapsed: number
    daysRemaining: number
    currentCost: number
    projectedMonthlyCost: number
  }
  byDevice: DeviceCostBreakdownDTO[]
  balance: number | null
  currency: string
}

// ─── Mapper Functions ──────────────────────────────────────────────────────────

export function toDailyCountDTO(
  row: Prisma.WhatsappDailyCountGetPayload<Prisma.WhatsappDailyCountDefaultArgs>
): WhatsappDailyCountDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    date: row.date,
    sessionCount: row.sessionCount,
    messageInboxCount: row.messageInboxCount,
    messageOutboxCount: row.messageOutboxCount,
    messageFailedCount: row.messageFailedCount,
    whatsappDeviceId: row.whatsappDeviceId,
  }
}

export function toMonthlyCountDTO(
  row: Prisma.WhatsappMonthlyCountGetPayload<Prisma.WhatsappMonthlyCountDefaultArgs>
): WhatsappMonthlyCountDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    year: row.year,
    month: row.month,
    sessionCount: row.sessionCount,
    messageInboxCount: row.messageInboxCount,
    messageOutboxCount: row.messageOutboxCount,
    messageFailedCount: row.messageFailedCount,
    whatsappDeviceId: row.whatsappDeviceId,
  }
}

export function toCostDTO(
  row: Prisma.BillingUsageLedgerGetPayload<Prisma.BillingUsageLedgerDefaultArgs>
): BillingCostDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    period: row.period,
    category: row.category,
    amountIdr: row.amountIdr,
    metadata: row.metadata,
  }
}
