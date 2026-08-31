import { prisma as defaultPrisma } from "@/lib/prisma"

import {
  toDTO,
  type DailyOperationsDTO,
  type DailyOperationsMetric,
  type DailyOperationsSnapshot,
} from "./daily-operations.dto"

type QueueRecord = {
  createdAt?: Date | null
  startedAt?: Date | null
  updatedAt?: Date | null
}

type QueueDelegate = {
  count: (args: Record<string, unknown>) => Promise<number>
  findFirst?: (args: Record<string, unknown>) => Promise<QueueRecord | null>
}

export type DailyOperationsPrisma = {
  paymentConfirmation: QueueDelegate
  applicationDeployment: QueueDelegate
  supportTicket: QueueDelegate
  billingInvoice: QueueDelegate
  billingOrder: QueueDelegate
}

type OverviewOptions = {
  now?: Date
}

type MetricDefinition = {
  key: string
  label: string
  priority: DailyOperationsMetric["priority"]
  href: string
  where: Record<string, unknown>
  since?: Date
  activeMessage: string
  cleanMessage: string
  unavailableMessage: string
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

const getOldestTimestamp = (record: QueueRecord | null): Date | null => {
  if (!record) return null
  return record.createdAt ?? record.startedAt ?? record.updatedAt ?? null
}

const getAgeMinutes = (oldestAt: Date | null, now: Date): number | null => {
  if (!oldestAt) return null
  return Math.max(0, Math.floor((now.getTime() - oldestAt.getTime()) / 60000))
}

const createMetric = async (
  delegate: QueueDelegate,
  definition: MetricDefinition,
  now: Date
): Promise<DailyOperationsMetric> => {
  const countArgs: Record<string, unknown> = { where: definition.where }
  if (definition.since) {
    countArgs.where = {
      AND: [
        definition.where,
        {
          createdAt: {
            gte: definition.since,
          },
        },
      ],
    }
  }

  const oldestArgs: Record<string, unknown> = {
    where: countArgs.where,
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  }

  const [countResult, oldestResult] = await Promise.allSettled([
    delegate.count(countArgs),
    delegate.findFirst
      ? delegate.findFirst(oldestArgs)
      : Promise.reject(new Error("oldest queue query is unavailable")),
  ])

  const count = countResult.status === "fulfilled" ? countResult.value : 0
  const oldestRecord =
    oldestResult.status === "fulfilled" ? oldestResult.value : null
  const oldestAt = getOldestTimestamp(oldestRecord)
  const available =
    countResult.status === "fulfilled" && oldestResult.status === "fulfilled"

  return {
    key: definition.key,
    label: definition.label,
    priority: definition.priority,
    count,
    href: definition.href,
    oldestAt,
    ageMinutes: getAgeMinutes(oldestAt, now),
    message: !available
      ? definition.unavailableMessage
      : count === 0
        ? definition.cleanMessage
        : definition.activeMessage.replace("{count}", String(count)),
    available,
  }
}

export class DailyOperationsService {
  private readonly prisma: DailyOperationsPrisma

  constructor(
    prisma: DailyOperationsPrisma = defaultPrisma as unknown as DailyOperationsPrisma
  ) {
    this.prisma = prisma
  }

  async getOverview(
    options: OverviewOptions = {}
  ): Promise<DailyOperationsDTO> {
    const now = options.now ?? new Date()
    const since = new Date(now.getTime() - DAY_IN_MILLISECONDS)

    const definitions: Array<{
      name: keyof DailyOperationsSnapshot
      delegate: QueueDelegate
      definition: MetricDefinition
    }> = [
      {
        name: "paymentsAwaitingConfirmation",
        delegate: this.prisma.paymentConfirmation,
        definition: {
          key: "payments-awaiting-confirmation",
          label: "Pembayaran menunggu konfirmasi",
          priority: "HIGH",
          href: "/portal/billing/payments?status=PENDING",
          where: { status: "PENDING" },
          activeMessage: "{count} pembayaran menunggu konfirmasi",
          cleanMessage: "Semua pembayaran telah dikonfirmasi",
        },
      },
      {
        name: "failedDeployments",
        delegate: this.prisma.applicationDeployment,
        definition: {
          key: "failed-or-building-deployments",
          label: "Deployment gagal atau sedang dibangun",
          priority: "HIGH",
          href: "/portal/app/clusters",
          where: { status: { in: ["FAILED", "BUILDING"] } },
          activeMessage: "{count} deployment perlu ditindaklanjuti",
          cleanMessage: "Antrean bersih",
        },
      },
      {
        name: "supportTickets",
        delegate: this.prisma.supportTicket,
        definition: {
          key: "support-tickets-needing-response",
          label: "Tiket dukungan menunggu respons",
          priority: "HIGH",
          href: "/portal/support-tickets?status=OPEN",
          where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
          activeMessage: "{count} tiket menunggu respons",
          cleanMessage: "Antrean bersih",
        },
      },
      {
        name: "overdueInvoices",
        delegate: this.prisma.billingInvoice,
        definition: {
          key: "overdue-or-open-invoices",
          label: "Invoice terbuka atau jatuh tempo",
          priority: "HIGH",
          href: "/portal/billing/invoices?status=OVERDUE",
          where: {
            OR: [
              { status: { in: ["OPEN", "OVERDUE"] } },
              { dueAt: { lt: now } },
              { dueDate: { lt: now } },
            ],
          },
          activeMessage: "{count} invoice perlu ditindaklanjuti",
          cleanMessage: "Antrean bersih",
        },
      },
      {
        name: "newOrders",
        delegate: this.prisma.billingOrder,
        definition: {
          key: "new-orders",
          label: "order baru dalam 24 jam",
          priority: "INFO",
          href: "/portal/billing/orders",
          where: {},
          since,
          activeMessage: "{count} order baru",
          cleanMessage: "Antrean bersih",
        },
      },
      {
        name: "newInvoices",
        delegate: this.prisma.billingInvoice,
        definition: {
          key: "new-invoices",
          label: "invoice baru dalam 24 jam",
          priority: "INFO",
          href: "/portal/billing/invoices",
          where: {},
          since,
          activeMessage: "{count} invoice baru",
          cleanMessage: "Antrean bersih",
        },
      },
    ]

    const entries = await Promise.all(
      definitions.map(
        async ({ name, delegate, definition }) =>
          [name, await createMetric(delegate, definition, now)] as const
      )
    )
    const metrics = Object.fromEntries(entries) as Record<
      keyof DailyOperationsSnapshot,
      DailyOperationsMetric
    >

    return toDTO({
      generatedAt: now,
      paymentsAwaitingConfirmation: metrics.paymentsAwaitingConfirmation,
      failedDeployments: metrics.failedDeployments,
      supportTickets: metrics.supportTickets,
      overdueInvoices: metrics.overdueInvoices,
      newOrders: metrics.newOrders,
      newInvoices: metrics.newInvoices,
    })
  }
}

export const dailyOperationsService = new DailyOperationsService()
