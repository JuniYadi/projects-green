import type { Prisma } from "@prisma/client"

const PERIOD_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
} as const

export const adminSubscriptionInclude = {
  package: { select: { code: true } },
  plan: { select: { code: true } },
  pricing: {
    select: {
      billingMode: true,
      type: true,
      basePriceIdr: true,
      billingPeriod: true,
      periodPrice: true,
      currency: true,
      chargeUnit: true,
      region: { select: { code: true } },
    },
  },
  orders: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      billingInvoice: { select: { status: true } },
    },
  },
  vpnSubscription: { select: { id: true } },
} satisfies Prisma.ServiceSubscriptionInclude

export type AdminSubscriptionRecord = Prisma.ServiceSubscriptionGetPayload<{
  include: typeof adminSubscriptionInclude
}>

export type AdminSubscriptionDTO = {
  id: string
  organizationId: string | null
  packageCode: string
  planCode: string
  regionCode: string
  pricingId: string
  billingPeriod: string
  periodMonths: number | null
  periodPrice: string
  currency: string
  quantity: string
  billingMode: string
  type: string
  status: string
  orderId: string | null
  orderStatus: string | null
  billingInvoiceId: string | null
  invoiceStatus: string | null
  allocatedConfig: Record<string, unknown> | null
  monthlyRateIdr: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  fulfillment: null
  cancelAtPeriodEnd: boolean
  vpnSubscriptionId: string | null
}

export function toAdminSubscriptionDTO(
  subscription: AdminSubscriptionRecord
): AdminSubscriptionDTO {
  const order = subscription.orders?.[0]
  const billingPeriod = subscription.billingPeriod as string

  return {
    id: subscription.id,
    organizationId: subscription.organizationId ?? null,
    packageCode: subscription.package.code,
    planCode: subscription.plan.code,
    regionCode: subscription.pricing.region.code,
    pricingId: subscription.pricingId,
    billingPeriod,
    periodMonths:
      PERIOD_MONTHS[billingPeriod as keyof typeof PERIOD_MONTHS] ?? null,
    periodPrice:
      subscription.priceLocked?.toFixed(2) ??
      subscription.pricing.periodPrice?.toFixed?.(2) ??
      subscription.pricing.basePriceIdr.toFixed(2),
    currency: subscription.currency ?? subscription.pricing.currency ?? "IDR",
    quantity: subscription.quantity?.toString() ?? "1",
    billingMode: subscription.pricing.billingMode,
    type: subscription.pricing.type,
    status: subscription.status,
    orderId: order?.id ?? null,
    orderStatus: order?.status ?? null,
    billingInvoiceId: order?.billingInvoiceId ?? null,
    invoiceStatus: order?.billingInvoice?.status ?? null,
    allocatedConfig: subscription.allocatedConfig as Record<
      string,
      unknown
    > | null,
    monthlyRateIdr: subscription.pricing.basePriceIdr.toFixed(2),
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    fulfillment: null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    vpnSubscriptionId: subscription.vpnSubscription?.id ?? null,
  }
}
