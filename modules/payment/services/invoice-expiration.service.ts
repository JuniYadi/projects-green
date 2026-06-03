import { prisma } from "@/lib/prisma"
import { PAYMENT_CONSTANTS } from "../constants"

export class InvoiceExpirationService {
  async expireOverdueInvoices(): Promise<{ expired: number }> {
    const overdueThreshold = new Date()
    overdueThreshold.setHours(
      overdueThreshold.getHours() - PAYMENT_CONSTANTS.DEFAULT_EXPIRY_DAYS * 24
    )

    const result = await prisma.invoice.updateMany({
      where: {
        status: "OPEN",
        createdAt: { lt: overdueThreshold },
      },
      data: { status: "VOID" },
    })

    return { expired: result.count }
  }

  async getExpiringInvoices(hoursUntilExpiry = 24) {
    const threshold = new Date()
    threshold.setHours(threshold.getHours() + hoursUntilExpiry)

    return prisma.invoice.findMany({
      where: {
        status: "OPEN",
        dueDate: { lte: threshold },
      },
      include: {
        billingAccount: { select: { organizationId: true } },
      },
    })
  }
}
