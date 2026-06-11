import { Prisma } from "@prisma/client"

export interface PaymentConfirmationDTO {
  id: string
  amount: number
  currency: string
  bankAccountId: string
  bankName: string
  accountNumber: string
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  notes: string | null
}

type ConfirmationWithRelations = Prisma.PaymentConfirmationGetPayload<{
  include: { invoice: true; bankAccount: true }
}>

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
    accountNumber: confirmation.bankAccount.accountNumber,
    status: confirmation.status.toLowerCase() as PaymentConfirmationDTO["status"],
    submittedAt: confirmation.createdAt.toISOString(),
    notes: confirmation.notes,
  }
}
