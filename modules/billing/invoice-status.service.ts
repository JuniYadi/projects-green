import { PrismaClient } from "@prisma/client"
import type { InvoiceEmailService } from "@/modules/invoices/email.service"
import type { InvoiceListItem, InvoiceStatus } from "@/modules/invoices/invoices.types"

const ISSUE_THRESHOLD_DAYS = 5
const OVERDUE_GRACE_DAYS = 14
const PAYMENT_REMINDER_DAYS = 3

const PRISMA_STATUS_TO_EMAIL_STATUS: Record<string, InvoiceStatus> = {
  DRAFT: "draft",
  ISSUED: "open",
  OPEN: "open",
  PAID: "paid",
  OVERDUE: "open",
  CANCELLED: "canceled",
  VOID: "canceled",
  UNCOLLECTIBLE: "uncollectible",
}

function toInvoiceListItem(invoice: {
  id: string
  invoiceNumber: string
  totalAmount: { toNumber: () => number }
  currency: string
  status: string
  periodStart: Date
  periodEnd: Date
  issuedAt: Date | null
  dueAt: Date | null
}): InvoiceListItem {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount.toNumber(),
    currency: invoice.currency,
    status: PRISMA_STATUS_TO_EMAIL_STATUS[invoice.status] ?? "draft",
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
  }
}

export class InvoiceStatusManager {
  // Cache org → admin email to avoid N+1 WorkOS API calls
  private orgEmailCache = new Map<string, string | null>()

  constructor(
    private prisma: PrismaClient,
    private emailService?: InvoiceEmailService,
  ) {}

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

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: "DRAFT",
        createdAt: { lt: threshold },
      },
      include: { billingAccount: true },
    })

    let issued = 0

    for (const invoice of invoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
        },
      })

      issued++

      // Fire-and-forget: email delivery is best-effort, invoice status already updated
      if (this.emailService && invoice.billingAccount?.organizationId) {
        void this.sendInvoiceCreatedEmail(invoice, invoice.billingAccount.organizationId)
      }
    }

    return { issued }
  }

  async markOverdueInvoices(): Promise<{ overdue: number }> {
    const overdueThreshold = new Date()
    overdueThreshold.setDate(overdueThreshold.getDate() - OVERDUE_GRACE_DAYS)

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: "ISSUED",
        dueAt: { lt: overdueThreshold },
      },
      include: { billingAccount: true },
    })

    let overdue = 0

    for (const invoice of invoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "OVERDUE" },
      })

      overdue++

      // Fire-and-forget: email delivery is best-effort, invoice status already updated
      if (this.emailService && invoice.billingAccount?.organizationId) {
        void this.sendInvoiceOverdueEmail(invoice, invoice.billingAccount.organizationId)
      }
    }

    return { overdue }
  }

  async sendPaymentReminders(): Promise<{ sent: number }> {
    const now = new Date()
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + PAYMENT_REMINDER_DAYS)

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: "ISSUED",
        dueAt: {
          gte: now,
          lte: threshold,
        },
      },
      include: { billingAccount: true },
    })

    let sent = 0

    for (const invoice of invoices) {
      // Idempotency: skip if reminder already sent today
      const metadata = (invoice.metadataJson as Record<string, unknown>) ?? {}
      const lastReminderAt = metadata.lastReminderAt as string | undefined
      if (lastReminderAt) {
        const lastDate = new Date(lastReminderAt).toDateString()
        if (lastDate === now.toDateString()) {
          continue // Already sent reminder today
        }
      }

      if (this.emailService && invoice.billingAccount?.organizationId) {
        const reminderCount = ((metadata.reminderCount as number) ?? 0) + 1

        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            metadataJson: {
              ...metadata,
              lastReminderAt: now.toISOString(),
              reminderCount,
            },
          },
        })

        await this.sendPaymentReminderEmail(invoice, invoice.billingAccount.organizationId)
        sent++
      }
    }

    return { sent }
  }

  private async sendInvoiceCreatedEmail(
    invoice: { id: string; invoiceNumber: string; totalAmount: { toNumber: () => number }; currency: string; status: string; periodStart: Date; periodEnd: Date; issuedAt: Date | null; dueAt: Date | null },
    organizationId: string,
  ): Promise<void> {
    try {
      const recipientEmail = await this.resolveOrgAdminEmail(organizationId)
      if (!recipientEmail) return

      await this.emailService!.sendInvoiceCreated(
        toInvoiceListItem(invoice),
        recipientEmail,
      )
    } catch (error) {
      console.error(
        `[InvoiceStatusManager] Failed to send invoice-created email for ${invoice.invoiceNumber}:`,
        error,
      )
    }
  }

  private async sendInvoiceOverdueEmail(
    invoice: { id: string; invoiceNumber: string; totalAmount: { toNumber: () => number }; currency: string; status: string; periodStart: Date; periodEnd: Date; issuedAt: Date | null; dueAt: Date | null },
    organizationId: string,
  ): Promise<void> {
    try {
      const recipientEmail = await this.resolveOrgAdminEmail(organizationId)
      if (!recipientEmail) return

      await this.emailService!.sendInvoiceOverdue(
        toInvoiceListItem(invoice),
        recipientEmail,
      )
    } catch (error) {
      console.error(
        `[InvoiceStatusManager] Failed to send invoice-overdue email for ${invoice.invoiceNumber}:`,
        error,
      )
    }
  }

  private async sendPaymentReminderEmail(
    invoice: { id: string; invoiceNumber: string; totalAmount: { toNumber: () => number }; currency: string; status: string; periodStart: Date; periodEnd: Date; issuedAt: Date | null; dueAt: Date | null },
    organizationId: string,
  ): Promise<void> {
    try {
      const recipientEmail = await this.resolveOrgAdminEmail(organizationId)
      if (!recipientEmail) return

      await this.emailService!.sendPaymentReminder(
        toInvoiceListItem(invoice),
        recipientEmail,
      )
    } catch (error) {
      console.error(
        `[InvoiceStatusManager] Failed to send payment-reminder email for ${invoice.invoiceNumber}:`,
        error,
      )
    }
  }

  private async resolveOrgAdminEmail(organizationId: string): Promise<string | null> {
    // Check cache first to avoid N+1 WorkOS API calls
    if (this.orgEmailCache.has(organizationId)) {
      return this.orgEmailCache.get(organizationId) ?? null
    }

    try {
      const { createWorkOS } = await import("@workos-inc/node")
      const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })

      const memberships = await workos.userManagement
        .listOrganizationMemberships({
          organizationId,
          statuses: ["active"],
        })
        .then((r) => r.autoPagination())

      const admin = memberships.find((m) => {
        const slug = m.role?.slug?.toLowerCase()
        return slug === "user_owner" || slug === "user_admin"
      })

      if (!admin?.userId) {
        this.orgEmailCache.set(organizationId, null)
        return null
      }

      const user = await workos.userManagement.getUser(admin.userId)
      const email = user.email
      this.orgEmailCache.set(organizationId, email)
      return email
    } catch (error) {
      console.error(
        `[InvoiceStatusManager] Failed to resolve admin email for org ${organizationId}:`,
        error,
      )
      // Cache null to avoid repeated failed lookups for same org
      this.orgEmailCache.set(organizationId, null)
      return null
    }
  }
}
