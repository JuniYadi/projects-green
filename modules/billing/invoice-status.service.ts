import { PrismaClient } from "@prisma/client"

const ISSUE_THRESHOLD_DAYS = 5
const OVERDUE_GRACE_DAYS = 14

export class InvoiceStatusManager {
  constructor(private prisma: PrismaClient) {}

  async runDailyTransitions(): Promise<{
    issued: number
    overdue: number
  }> {
    const issued = await this.issueDraftInvoices()
    const overdue = await this.markOverdueInvoices()

    console.info(
      `[InvoiceStatusManager] Daily transitions: ${issued.issued} issued, ${overdue.overdue} overdue`,
    )

    return { issued: issued.issued, overdue: overdue.overdue }
  }

  async issueDraftInvoices(): Promise<{ issued: number }> {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - ISSUE_THRESHOLD_DAYS)

    const result = await this.prisma.invoice.updateMany({
      where: {
        status: "DRAFT",
        createdAt: { lt: threshold },
      },
      data: {
        status: "ISSUED",
        issuedAt: new Date(),
      },
    })

    return { issued: result.count }
  }

  async markOverdueInvoices(): Promise<{ overdue: number }> {
    const overdueThreshold = new Date()
    overdueThreshold.setDate(overdueThreshold.getDate() - OVERDUE_GRACE_DAYS)

    const result = await this.prisma.invoice.updateMany({
      where: {
        status: "ISSUED",
        dueAt: { lt: overdueThreshold },
      },
      data: {
        status: "OVERDUE",
      },
    })

    return { overdue: result.count }
  }
}
