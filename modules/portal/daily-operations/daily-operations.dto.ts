export type DailyOperationsPriority = "HIGH" | "INFO"

export type DailyOperationsMetric = {
  key: string
  label: string
  priority: DailyOperationsPriority
  count: number
  href: string
  oldestAt: Date | null
  ageMinutes: number | null
  message: string
  available: boolean
}

export type DailyOperationsMetricDTO = {
  key: string
  label: string
  priority: DailyOperationsPriority
  count: number
  href: string
  oldestAt: string | null
  ageMinutes: number | null
  message: string
  available: boolean
}

export type DailyOperationsSnapshot = {
  generatedAt: Date
  paymentsAwaitingConfirmation: DailyOperationsMetric
  failedDeployments: DailyOperationsMetric
  supportTickets: DailyOperationsMetric
  overdueInvoices: DailyOperationsMetric
  newOrders: DailyOperationsMetric
  newInvoices: DailyOperationsMetric
}

export type DailyOperationsDTO = {
  generatedAt: string
  actionRequired: DailyOperationsMetricDTO[]
  queueSummary: DailyOperationsMetricDTO[]
  paymentsAwaitingConfirmation: DailyOperationsMetricDTO
  failedDeployments: DailyOperationsMetricDTO
  supportTickets: DailyOperationsMetricDTO
  overdueInvoices: DailyOperationsMetricDTO
  newOrders: DailyOperationsMetricDTO
  newInvoices: DailyOperationsMetricDTO
}

const metricToDTO = (
  metric: DailyOperationsMetric
): DailyOperationsMetricDTO => ({
  key: metric.key,
  label: metric.label,
  priority: metric.priority,
  count: metric.count,
  href: metric.href,
  oldestAt: metric.oldestAt?.toISOString() ?? null,
  ageMinutes: metric.ageMinutes,
  message: metric.message,
  available: metric.available,
})

export const toDTO = (
  snapshot: DailyOperationsSnapshot
): DailyOperationsDTO => {
  const paymentsAwaitingConfirmation = metricToDTO(
    snapshot.paymentsAwaitingConfirmation
  )
  const failedDeployments = metricToDTO(snapshot.failedDeployments)
  const supportTickets = metricToDTO(snapshot.supportTickets)
  const overdueInvoices = metricToDTO(snapshot.overdueInvoices)
  const newOrders = metricToDTO(snapshot.newOrders)
  const newInvoices = metricToDTO(snapshot.newInvoices)

  return {
    generatedAt: snapshot.generatedAt.toISOString(),
    actionRequired: [
      paymentsAwaitingConfirmation,
      failedDeployments,
      supportTickets,
      overdueInvoices,
    ],
    queueSummary: [newOrders, newInvoices],
    paymentsAwaitingConfirmation,
    failedDeployments,
    supportTickets,
    overdueInvoices,
    newOrders,
    newInvoices,
  }
}

export const toDailyOperationsDTO = toDTO
