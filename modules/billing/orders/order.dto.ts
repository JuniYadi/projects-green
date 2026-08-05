import type { BillingPeriod, Prisma, ServiceType } from "@prisma/client"

type BillingOrderStatus =
  | "PENDING"
  | "CHARGED"
  | "FULFILLED"
  | "FAILED"
  | "CANCELLED"
type BillingChargeUnit = "SUBSCRIPTION" | "DEVICE"

export type BillingOrderLineDTO = {
  id: string
  pricingId: string | null
  packageCode: ServiceType
  planCode: string
  regionCode: string
  billingPeriod: BillingPeriod
  chargeUnit: BillingChargeUnit
  quantity: string
  unitPrice: string
  amount: string
  currency: string
  periodStart: string
  periodEnd: string
  metadata: Prisma.JsonValue | null
}

export type BillingOrderDTO = {
  id: string
  organizationId: string
  billingAccountId: string
  serviceSubscriptionId: string | null
  billingInvoiceId: string | null
  status: BillingOrderStatus
  currency: string
  subtotalAmount: string
  totalAmount: string
  idempotencyKey: string
  chargedAt: string | null
  fulfilledAt: string | null
  createdAt: string
  updatedAt: string
  line: BillingOrderLineDTO | null
  subscription: {
    id: string
    status: string
    packageCode: ServiceType
    planCode: string
    currentPeriodStart: string
    currentPeriodEnd: string
  } | null
  invoice: {
    id: string
    invoiceNumber: string
    status: string
    paidAt: string | null
  } | null
}

const decimalString = (value: Prisma.Decimal) => value.toString()

export function toBillingOrderDTO(order: {
  id: string
  organizationId: string
  billingAccountId: string
  serviceSubscriptionId: string | null
  billingInvoiceId: string | null
  status: BillingOrderStatus
  currency: string
  subtotalAmount: Prisma.Decimal
  totalAmount: Prisma.Decimal
  idempotencyKey: string
  chargedAt: Date | null
  fulfilledAt: Date | null
  createdAt: Date
  updatedAt: Date
  lines: Array<{
    id: string
    pricingId: string | null
    packageCode: ServiceType
    planCode: string
    regionCode: string
    billingPeriod: BillingPeriod
    chargeUnit: BillingChargeUnit
    quantity: Prisma.Decimal
    unitPrice: Prisma.Decimal
    amount: Prisma.Decimal
    currency: string
    periodStart: Date
    periodEnd: Date
    metadataJson: Prisma.JsonValue | null
  }>
  serviceSubscription: {
    id: string
    status: string
    package: { code: ServiceType }
    plan: { code: string }
    currentPeriodStart: Date
    currentPeriodEnd: Date
  } | null
  billingInvoice: {
    id: string
    invoiceNumber: string
    status: string
    paidAt: Date | null
  } | null
}): BillingOrderDTO {
  const line = order.lines[0]
  return {
    id: order.id,
    organizationId: order.organizationId,
    billingAccountId: order.billingAccountId,
    serviceSubscriptionId: order.serviceSubscriptionId,
    billingInvoiceId: order.billingInvoiceId,
    status: order.status,
    currency: order.currency,
    subtotalAmount: decimalString(order.subtotalAmount),
    totalAmount: decimalString(order.totalAmount),
    idempotencyKey: order.idempotencyKey,
    chargedAt: order.chargedAt?.toISOString() ?? null,
    fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    line: line
      ? {
          id: line.id,
          pricingId: line.pricingId,
          packageCode: line.packageCode,
          planCode: line.planCode,
          regionCode: line.regionCode,
          billingPeriod: line.billingPeriod,
          chargeUnit: line.chargeUnit,
          quantity: decimalString(line.quantity),
          unitPrice: decimalString(line.unitPrice),
          amount: decimalString(line.amount),
          currency: line.currency,
          periodStart: line.periodStart.toISOString(),
          periodEnd: line.periodEnd.toISOString(),
          metadata: line.metadataJson,
        }
      : null,
    subscription: order.serviceSubscription
      ? {
          id: order.serviceSubscription.id,
          status: order.serviceSubscription.status,
          packageCode: order.serviceSubscription.package.code,
          planCode: order.serviceSubscription.plan.code,
          currentPeriodStart:
            order.serviceSubscription.currentPeriodStart.toISOString(),
          currentPeriodEnd:
            order.serviceSubscription.currentPeriodEnd.toISOString(),
        }
      : null,
    invoice: order.billingInvoice
      ? {
          id: order.billingInvoice.id,
          invoiceNumber: order.billingInvoice.invoiceNumber,
          status: order.billingInvoice.status,
          paidAt: order.billingInvoice.paidAt?.toISOString() ?? null,
        }
      : null,
  }
}
