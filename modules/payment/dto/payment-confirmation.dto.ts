import { Prisma } from "@prisma/client"

import { getEncryptionService } from "../services/encryption.service"

export interface PaymentConfirmationDTO {
  id: string
  amount: number
  currency: string
  bankAccountId: string
  bankName: string
  accountName: string
  accountNumber: string
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  notes: string | null
}

type ConfirmationWithRelations = Prisma.PaymentConfirmationGetPayload<{
  include: { invoice: true; bankAccount: true }
}>

function decryptPaymentField(value: string | null | undefined): string {
  if (!value) return ""

  try {
    return getEncryptionService().decryptFieldOptional(value) ?? value
  } catch {
    return value
  }
}

export function toPaymentConfirmationDTO(
  confirmation: ConfirmationWithRelations
): PaymentConfirmationDTO {
  return {
    id: confirmation.id,
    amount: Number(confirmation.amount),
    currency:
      confirmation.invoice?.currency ?? confirmation.bankAccount.currency,
    bankAccountId: confirmation.bankAccountId,
    bankName: confirmation.bankAccount.bankName,
    accountName: decryptPaymentField(confirmation.bankAccount.accountName),
    accountNumber: decryptPaymentField(confirmation.bankAccount.accountNumber),
    status:
      confirmation.status.toLowerCase() as PaymentConfirmationDTO["status"],
    submittedAt: confirmation.createdAt.toISOString(),
    notes: confirmation.notes,
  }
}
