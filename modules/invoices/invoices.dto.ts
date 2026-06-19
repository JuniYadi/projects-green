import type { InvoiceDetailRecord } from "@/modules/invoices/invoices.repository"
import type {
  PaymentConfirmationDTO,
  PaymentConfirmationStatus,
  PaymentInfoDTO,
  PaymentReferenceInfo,
  PaymentTimelineEvent,
} from "@/modules/invoices/invoices.types"

const toNumber = (value: unknown) => Number(value ?? 0)

const toConfirmationStatus = (value: string): PaymentConfirmationStatus => {
  const upper = value.toUpperCase()
  if (upper === "APPROVED" || upper === "REJECTED") {
    return upper
  }
  return "PENDING"
}

const readMetadataString = (
  metadata: unknown,
  keys: string[]
): string | null => {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const record = metadata as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim().length > 0) {
      return value
    }
  }

  return null
}

export const toPaymentConfirmationDTO = (
  confirmation: InvoiceDetailRecord["paymentConfirmations"][number]
): PaymentConfirmationDTO => {
  return {
    id: confirmation.id,
    bankAccountId: confirmation.bankAccountId,
    bankName: confirmation.bankAccount.bankName,
    accountName: confirmation.bankAccount.accountName,
    amount: toNumber(confirmation.amount),
    currency: confirmation.bankAccount.currency,
    senderName: confirmation.senderName,
    senderBankName: confirmation.senderBankName,
    senderAccount: confirmation.senderAccount,
    screenshotUrl: confirmation.screenshotUrl,
    notes: confirmation.notes,
    status: toConfirmationStatus(confirmation.status),
    rejectReason: confirmation.rejectReason,
    reviewedAt: confirmation.reviewedAt?.toISOString() ?? null,
    paymentDateTime: confirmation.paymentDateTime.toISOString(),
    createdAt: confirmation.createdAt.toISOString(),
  }
}

const buildPaymentReference = (
  metadata: unknown
): PaymentReferenceInfo | null => {
  const vaNumber = readMetadataString(metadata, ["vaNumber", "va_number"])
  const paymentUrl = readMetadataString(metadata, ["paymentUrl", "payment_url"])
  const gatewayReference = readMetadataString(metadata, [
    "duitkuReference",
    "gatewayReference",
    "reference",
  ])

  if (!vaNumber && !paymentUrl && !gatewayReference) {
    return null
  }

  return {
    vaNumber,
    paymentUrl,
    gatewayReference,
  }
}

const buildPaymentTimeline = (
  invoice: InvoiceDetailRecord
): PaymentTimelineEvent[] => {
  const events: PaymentTimelineEvent[] = []

  if (invoice.issuedAt) {
    events.push({
      type: "issued",
      label: "Invoice issued",
      at: invoice.issuedAt.toISOString(),
    })
  }

  for (const confirmation of invoice.paymentConfirmations) {
    events.push({
      type: "payment_submitted",
      label: "Payment submitted",
      at: confirmation.createdAt.toISOString(),
    })

    if (confirmation.reviewedAt) {
      const status = toConfirmationStatus(confirmation.status)
      if (status === "APPROVED") {
        events.push({
          type: "payment_approved",
          label: "Payment approved",
          at: confirmation.reviewedAt.toISOString(),
        })
      } else if (status === "REJECTED") {
        events.push({
          type: "payment_rejected",
          label: "Payment rejected",
          at: confirmation.reviewedAt.toISOString(),
        })
      }
    }
  }

  if (invoice.paidAt) {
    events.push({
      type: "paid",
      label: "Invoice paid",
      at: invoice.paidAt.toISOString(),
    })
  }

  return events.sort((a, b) => a.at.localeCompare(b.at))
}

export const toPaymentInfoDTO = (
  invoice: InvoiceDetailRecord
): PaymentInfoDTO | null => {
  const hasPaymentData =
    invoice.paymentMethod ||
    invoice.gateway ||
    invoice.paymentConfirmations.length > 0 ||
    buildPaymentReference(invoice.metadata)

  if (!hasPaymentData) {
    return null
  }

  return {
    method: invoice.paymentMethod ?? null,
    gateway: invoice.gateway
      ? {
          id: invoice.gateway.id,
          name: invoice.gateway.name,
          type: invoice.gateway.type,
        }
      : null,
    reference: buildPaymentReference(invoice.metadata),
    confirmations: invoice.paymentConfirmations.map((confirmation) =>
      toPaymentConfirmationDTO(confirmation)
    ),
    timeline: buildPaymentTimeline(invoice),
  }
}
