import { z } from "zod"

export const PaymentMethod = {
  VIRTUAL_ACCOUNT: "VA",
  QRIS: "QRIS",
  MANUAL_BANK: "MANUAL_BANK",
} as const

export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const InvoiceType = {
  TOP_UP: "TOP_UP",
  SERVICE: "SERVICE",
  RECURRING: "RECURRING",
} as const

export type InvoiceTypeValue = (typeof InvoiceType)[keyof typeof InvoiceType]

export const ConfirmationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const

export type ConfirmationStatusValue = (typeof ConfirmationStatus)[keyof typeof ConfirmationStatus]

// Request/Response schemas using Zod
export const CreateTopupSchema = z.object({
  amount: z.number().min(10000).max(100000000),
  paymentMethod: z.enum(["VA", "QRIS", "MANUAL_BANK"]),
})

export const ConfirmPaymentSchema = z.object({
  bankAccountId: z.string(),
  amount: z.number(),
  paymentDateTime: z.string().datetime(),
  senderBankName: z.string().optional(),
  senderName: z.string().optional(),
  senderAccount: z.string().optional(),
  screenshotUrl: z.string().url().optional(),
  notes: z.string().optional(),
})

export const ReviewConfirmationSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
})

// Types for API responses
export interface PaymentGatewayResponse {
  id: string
  name: string
  type: string
  isActive: boolean
  isDefault: boolean
  config: {
    merchantCode: string
    sandboxUrl: string
    productionUrl: string
  }
}

export interface BankAccountResponse {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isActive: boolean
  isDefault: boolean
}

export interface PaymentConfirmationResponse {
  id: string
  invoiceId: string
  amount: number
  paymentDateTime: string
  senderBankName: string | null
  senderName: string | null
  senderAccount: string | null
  screenshotUrl: string | null
  notes: string | null
  status: ConfirmationStatusValue
  bankAccount: BankAccountResponse
  createdAt: string
}

// Duitku specific types
export interface DuitkuConfig {
  merchantCode: string
  apiKey: string
  sandboxUrl: string
  productionUrl: string
}

export interface DuitkuInquiryRequest {
  merchantCode: string
  paymentAmount: number
  merchantOrderId: string
  productDetails: string
  email: string
  paymentMethod: string
  customerVaName: string
  returnUrl: string
  callbackUrl: string
  signature: string
}

export interface DuitkuInquiryResponse {
  amount: number
  statusCode: string
  statusMessage: string
  paymentUrl?: string
  vaNumber?: string
  reference?: string
  merchantCode?: string
}
