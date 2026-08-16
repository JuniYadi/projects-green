import { Prisma, type PrismaClient, type ServiceType } from "@prisma/client"
import { z } from "zod"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"
import { buildAccountUsername } from "@/modules/vpn/subscriptions/vpn-account-username"

export type BillingFulfillmentInput = {
  orderId: string
  organizationId: string
  pricingId: string
  packageCode: ServiceType
  planId: string
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  currency: string
  periodStart: Date
  periodEnd: Date
  metadata: Record<string, unknown>
}

export const APP_HOSTING_FULFILLMENT_METADATA_KEY = "appHostingFulfillment"

export const appHostingFulfillmentContextSchema = z
  .object({
    stackId: z.string().min(1),
    deploymentId: z.string().min(1),
    sourceType: z.enum(["GITHUB", "PUBLIC", "TEMPLATE"]),
    resourcePlanId: z.enum(["starter", "pro", "payg"]),
  })
  .strict()

export type AppHostingFulfillmentContext = z.infer<
  typeof appHostingFulfillmentContextSchema
>

export type AppHostingFulfillmentFailure = {
  code:
    | "APP_HOSTING_FULFILLMENT_CONTEXT_REQUIRED"
    | "APP_HOSTING_FULFILLMENT_CONTEXT_INVALID"
  message: string
  retryable: boolean
}

export type AppHostingFulfillmentResult =
  | {
      ok: true
      subscriptionId: string
      context: AppHostingFulfillmentContext
    }
  | { ok: false; failure: AppHostingFulfillmentFailure }

export class AppHostingFulfillmentError extends Error {
  constructor(public readonly failure: AppHostingFulfillmentFailure) {
    super(failure.message)
    this.name = "AppHostingFulfillmentError"
  }
}

type AppHostingContextParseResult =
  | { ok: true; context: AppHostingFulfillmentContext }
  | { ok: false; failure: AppHostingFulfillmentFailure }

export function parseAppHostingFulfillmentContext(
  metadata: Record<string, unknown>
): AppHostingContextParseResult {
  const raw = metadata[APP_HOSTING_FULFILLMENT_METADATA_KEY]
  if (raw === undefined) {
    return {
      ok: false,
      failure: {
        code: "APP_HOSTING_FULFILLMENT_CONTEXT_REQUIRED",
        message:
          "A paid App Hosting order must include a deployment request and resource package.",
        retryable: false,
      },
    }
  }

  const parsed = appHostingFulfillmentContextSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        code: "APP_HOSTING_FULFILLMENT_CONTEXT_INVALID",
        message:
          "The App Hosting deployment request is invalid; retry with stack, deployment, source, and resource package references.",
        retryable: false,
      },
    }
  }

  return { ok: true, context: parsed.data }
}

export function sanitizeAppHostingOrderMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const invoiceLineId =
    typeof metadata.invoiceLineId === "string" ? metadata.invoiceLineId : null
  const parsed = parseAppHostingFulfillmentContext(metadata)
  if (parsed.ok) {
    return {
      [APP_HOSTING_FULFILLMENT_METADATA_KEY]: parsed.context,
      ...(invoiceLineId ? { invoiceLineId } : {}),
    }
  }

  if (metadata[APP_HOSTING_FULFILLMENT_METADATA_KEY] !== undefined) {
    return {
      [APP_HOSTING_FULFILLMENT_METADATA_KEY]: null,
      ...(invoiceLineId ? { invoiceLineId } : {}),
    }
  }

  return invoiceLineId ? { invoiceLineId } : {}
}

export type BillingFulfillmentAdapter = {
  packageCode: ServiceType
  create(
    input: BillingFulfillmentInput,
    transactionClient?: Prisma.TransactionClient
  ): Promise<{ subscriptionId: string }>
  renew(
    input: BillingFulfillmentInput,
    transactionClient?: Prisma.TransactionClient
  ): Promise<void>
}

type AdapterDependencies = {
  dispatch?: (serverAccountId: string) => Promise<void>
  username?: (organizationId: string) => string
}

type ServicePricingRecord = {
  id: string
  type: "PAYG" | "BUNDLE" | "CUSTOM"
  billingMode: "PACKAGE" | "PAYG" | "CUSTOM"
  billingPeriod:
    | "MONTHLY"
    | "QUARTERLY"
    | "SEMI_ANNUAL"
    | "ANNUAL"
    | "YEARLY"
    | "CUSTOM"
    | null
  periodPrice: Prisma.Decimal | null
  currency: string
  minimumCommitmentCycles: number | null
  servicePlan: {
    id: string
    packageId: string
    package: { id: string; code: ServiceType }
  }
}
type RecurringPricingRecord = ServicePricingRecord & {
  billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
  periodPrice: Prisma.Decimal | null
}
type ServiceSubscriptionRecord = {
  id: string
  organizationId: string
  packageId: string
  planId: string
  metadata: Prisma.JsonValue | null
}

type VpnPackageRecord = {
  id: string
  servicePlanId: string
  isActive: boolean
  servers: Array<{
    server: {
      id: string
      hasOpenVpn: boolean
      hasWireGuard: boolean
      hasProxy: boolean
    }
  }>
}

type VpnSubscriptionRecord = {
  id: string
  serverAccounts?: Array<{
    id: string
    serverId: string
    protocol: "OPENVPN" | "WIREGUARD" | "PROXY"
    provisioningStatus:
      | "PENDING"
      | "PROVISIONING"
      | "ACTIVE"
      | "FAILED"
      | "REVOKED"
  }>
}

type DeviceRecord = { id: string }

const PERIODS = new Set(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"])

function jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

function metadataObject(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function recurringPricing(
  pricing: ServicePricingRecord | null,
  input: BillingFulfillmentInput
): RecurringPricingRecord {
  if (!pricing) throw new Error("PRICING_NOT_FOUND")
  if (pricing.servicePlan.id !== input.planId)
    throw new Error("PLAN_PRICING_MISMATCH")
  if (pricing.servicePlan.package.code !== input.packageCode) {
    throw new Error("PACKAGE_PRICING_MISMATCH")
  }
  if (!pricing.billingPeriod || !PERIODS.has(pricing.billingPeriod)) {
    throw new Error("PRICING_NOT_RECURRING")
  }
  return pricing as RecurringPricingRecord
}

const PERIOD_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
  YEARLY: 12,
}

/**
 * Resolve the minimum commitment end date from the offer's cycle count.
 * Stamped on first create only — renewals must never extend a commitment.
 */
function commitmentEndsAt(
  pricing: RecurringPricingRecord,
  periodStart: Date
): Date | null {
  const cycles = pricing.minimumCommitmentCycles
  if (!cycles || cycles < 1) return null

  const months = PERIOD_MONTHS[pricing.billingPeriod] * cycles
  const end = new Date(periodStart)
  end.setUTCMonth(end.getUTCMonth() + months)
  return end
}

function subscriptionData(
  input: BillingFulfillmentInput,
  pricing: RecurringPricingRecord,
  metadata: Record<string, unknown>
) {
  return {
    packageId: pricing.servicePlan.packageId,
    planId: input.planId,
    pricingId: input.pricingId,
    type: pricing.type,
    billingMode: pricing.billingMode,
    billingPeriod: pricing.billingPeriod,
    priceLocked: input.unitPrice,
    currency: input.currency,
    quantity: input.quantity,
    status: "ACTIVE" as const,
    currentPeriodStart: input.periodStart,
    currentPeriodEnd: input.periodEnd,
    metadata: jsonObject(metadata),
  }
}

async function upsertServiceSubscription(
  tx: Prisma.TransactionClient,
  input: BillingFulfillmentInput,
  pricing: RecurringPricingRecord,
  metadata: Record<string, unknown>
): Promise<ServiceSubscriptionRecord> {
  const metadataSubscriptionId =
    typeof metadata.subscriptionId === "string" ? metadata.subscriptionId : null
  const explicitSubscription = metadataSubscriptionId
    ? await tx.serviceSubscription.findUnique({
        where: { id: metadataSubscriptionId },
      })
    : null
  if (
    metadataSubscriptionId &&
    (!explicitSubscription ||
      explicitSubscription.organizationId !== input.organizationId ||
      explicitSubscription.packageId !== pricing.servicePlan.packageId ||
      explicitSubscription.planId !== input.planId)
  ) {
    throw new Error("SUBSCRIPTION_NOT_FOUND")
  }
  const existing =
    explicitSubscription ??
    (await tx.serviceSubscription.findUnique({
      where: {
        organizationId_packageId_planId: {
          organizationId: input.organizationId,
          packageId: pricing.servicePlan.packageId,
          planId: input.planId,
        },
      },
    }))
  const data = subscriptionData(input, pricing, {
    ...metadataObject(existing?.metadata),
    ...metadata,
  })
  return existing
    ? tx.serviceSubscription.update({ where: { id: existing.id }, data })
    : tx.serviceSubscription.create({
        data: {
          organizationId: input.organizationId,
          ...data,
          commitmentEndsAt: commitmentEndsAt(pricing, input.periodStart),
        },
      })
}

function enabledProtocols(
  server: VpnPackageRecord["servers"][number]["server"]
): Array<"OPENVPN" | "WIREGUARD" | "PROXY"> {
  return [
    server.hasOpenVpn ? "OPENVPN" : null,
    server.hasWireGuard ? "WIREGUARD" : null,
    server.hasProxy ? "PROXY" : null,
  ].filter(
    (protocol): protocol is "OPENVPN" | "WIREGUARD" | "PROXY" =>
      protocol !== null
  )
}

async function createOrUpdateVpnFulfillment(
  tx: Prisma.TransactionClient,
  input: BillingFulfillmentInput,
  pricing: RecurringPricingRecord,
  metadata: Record<string, unknown>,
  username: (organizationId: string) => string
): Promise<{ subscriptionId: string; accountIds: string[] }> {
  const serviceSubscription = await upsertServiceSubscription(
    tx,
    input,
    pricing,
    metadata
  )
  const vpnPackage = (await tx.vpnPackage.findFirst({
    where: {
      servicePlanId: input.planId,
    } as unknown as Prisma.VpnPackageWhereInput,
    include: { servers: { include: { server: true } } },
  })) as VpnPackageRecord | null
  if (!vpnPackage || !vpnPackage.isActive)
    throw new Error("VPN_PACKAGE_NOT_FOUND")

  const existingVpn = (await tx.vpnSubscription.findFirst({
    where: {
      serviceSubscriptionId: serviceSubscription.id,
    } as unknown as Prisma.VpnSubscriptionWhereInput,
    include: { serverAccounts: true },
  })) as VpnSubscriptionRecord | null
  const vpnSubscription = existingVpn
    ? await tx.vpnSubscription.update({
        where: { id: existingVpn.id },
        data: {
          packageId: vpnPackage.id,
          status: "ACTIVE",
          priceLocked: input.unitPrice,
          currency: input.currency,
          currentPeriodStart: input.periodStart,
          currentPeriodEnd: input.periodEnd,
          renewalFailedAt: null,
        },
      })
    : await tx.vpnSubscription.create({
        data: {
          organizationId: input.organizationId,
          packageId: vpnPackage.id,
          serviceSubscriptionId: serviceSubscription.id,
          status: "ACTIVE",
          priceLocked: input.unitPrice,
          currency: input.currency,
          currentPeriodStart: input.periodStart,
          currentPeriodEnd: input.periodEnd,
        } as unknown as Prisma.VpnSubscriptionUncheckedCreateInput,
      })

  const existingAccounts = new Map(
    (existingVpn?.serverAccounts ?? []).map((account) => [
      `${account.serverId}:${account.protocol}`,
      account,
    ])
  )
  const accountIds: string[] = []
  for (const entry of vpnPackage.servers) {
    for (const protocol of enabledProtocols(entry.server)) {
      const key = `${entry.server.id}:${protocol}`
      const existingAccount = existingAccounts.get(key)
      if (existingAccount) {
        if (existingAccount.provisioningStatus !== "ACTIVE") {
          await tx.vpnServerAccount.update({
            where: { id: existingAccount.id },
            data: { provisioningStatus: "PENDING", failureReason: null },
          })
          accountIds.push(existingAccount.id)
        }
        continue
      }
      const account = await tx.vpnServerAccount.create({
        data: {
          subscriptionId: vpnSubscription.id,
          serverId: entry.server.id,
          protocol,
          username: username(input.organizationId),
          provisioningStatus: "PENDING",
        },
      })
      accountIds.push(account.id)
    }
  }
  return { subscriptionId: serviceSubscription.id, accountIds }
}

export function createVpnFulfillmentAdapter(
  prisma: PrismaClient = defaultPrisma,
  dependencies: AdapterDependencies = {}
): BillingFulfillmentAdapter {
  const dispatch =
    dependencies.dispatch ?? ((id: string) => VpnProvisioningJob.dispatch(id))
  const username = dependencies.username ?? buildAccountUsername

  const apply = async (
    input: BillingFulfillmentInput,
    transactionClient?: Prisma.TransactionClient
  ) => {
    const metadata = input.metadata
    const run = async (tx: Prisma.TransactionClient) => {
      const pricing = recurringPricing(
        (await tx.servicePricing.findUnique({
          where: { id: input.pricingId },
          include: { servicePlan: { include: { package: true } } },
        })) as ServicePricingRecord | null,
        input
      )
      return createOrUpdateVpnFulfillment(
        tx,
        input,
        pricing,
        metadata,
        username
      )
    }
    const result = transactionClient
      ? await run(transactionClient)
      : await prisma.$transaction(run)
    for (const accountId of result.accountIds) await dispatch(accountId)
    return result.subscriptionId
  }

  return {
    packageCode: "VPN",
    create: async (input, transactionClient) => ({
      subscriptionId: await apply(input, transactionClient),
    }),
    renew: async (input, transactionClient) => {
      await apply(input, transactionClient)
    },
  }
}

function allowanceMetadata(metadata: Record<string, unknown>): {
  deviceIds: string[]
  allowanceByDevice: Record<string, Prisma.Decimal>
} {
  const deviceIds = metadata.deviceIds
  const allowances = metadata.allowanceByDevice
  if (
    !Array.isArray(deviceIds) ||
    deviceIds.some((id) => typeof id !== "string")
  ) {
    throw new Error("WHATSAPP_DEVICE_METADATA_REQUIRED")
  }
  if (
    !allowances ||
    typeof allowances !== "object" ||
    Array.isArray(allowances)
  ) {
    throw new Error("WHATSAPP_ALLOWANCE_METADATA_REQUIRED")
  }
  const allowanceByDevice: Record<string, Prisma.Decimal> = {}
  for (const id of deviceIds) {
    const raw = (allowances as Record<string, unknown>)[id]
    if (raw === undefined || raw === null)
      throw new Error("WHATSAPP_ALLOWANCE_METADATA_REQUIRED")
    const allowance = new Prisma.Decimal(String(raw))
    if (allowance.isNegative()) throw new Error("WHATSAPP_ALLOWANCE_INVALID")
    allowanceByDevice[id] = allowance
  }
  return { deviceIds, allowanceByDevice }
}

async function applyWhatsappFulfillment(
  prisma: PrismaClient,
  input: BillingFulfillmentInput,
  transactionClient?: Prisma.TransactionClient
): Promise<string> {
  const run = async (tx: Prisma.TransactionClient) => {
    const pricing = recurringPricing(
      (await tx.servicePricing.findUnique({
        where: { id: input.pricingId },
        include: { servicePlan: { include: { package: true } } },
      })) as ServicePricingRecord | null,
      input
    )
    const existingId =
      typeof input.metadata.subscriptionId === "string"
        ? input.metadata.subscriptionId
        : null
    const existing = existingId
      ? await tx.serviceSubscription.findUnique({ where: { id: existingId } })
      : null
    const metadata = {
      ...metadataObject(existing?.metadata),
      ...input.metadata,
    }
    const { deviceIds, allowanceByDevice } = allowanceMetadata(metadata)
    const devices = (await tx.whatsappDevice.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: deviceIds },
        status: "ACTIVE",
      },
      select: { id: true },
    })) as DeviceRecord[]
    if (devices.length !== deviceIds.length)
      throw new Error("WHATSAPP_DEVICE_NOT_ACTIVE")

    const serviceSubscription = await upsertServiceSubscription(
      tx,
      input,
      pricing,
      metadata
    )
    for (const deviceId of deviceIds) {
      const allowance = allowanceByDevice[deviceId]
      await tx.whatsappDevice.update({
        where: { id: deviceId },
        data: { quotaBaseOut: allowance, quotaBase: allowance },
      })
    }
    return serviceSubscription.id
  }
  return transactionClient ? run(transactionClient) : prisma.$transaction(run)
}

export function createWhatsappFulfillmentAdapter(
  prisma: PrismaClient = defaultPrisma
): BillingFulfillmentAdapter {
  return {
    packageCode: "WHATSAPP",
    create: async (input, transactionClient) => ({
      subscriptionId: await applyWhatsappFulfillment(
        prisma,
        input,
        transactionClient
      ),
    }),
    renew: async (input, transactionClient) => {
      await applyWhatsappFulfillment(prisma, input, transactionClient)
    },
  }
}

async function applyAppHostingFulfillment(
  prisma: PrismaClient,
  input: BillingFulfillmentInput,
  transactionClient?: Prisma.TransactionClient
): Promise<AppHostingFulfillmentResult> {
  const parsed = parseAppHostingFulfillmentContext(input.metadata)
  if (!parsed.ok) throw new AppHostingFulfillmentError(parsed.failure)

  const run = async (
    tx: Prisma.TransactionClient
  ): Promise<AppHostingFulfillmentResult> => {
    const pricing = recurringPricing(
      (await tx.servicePricing.findUnique({
        where: { id: input.pricingId },
        include: { servicePlan: { include: { package: true } } },
      })) as ServicePricingRecord | null,
      input
    )
    const subscription = await upsertServiceSubscription(tx, input, pricing, {
      [APP_HOSTING_FULFILLMENT_METADATA_KEY]: parsed.context,
    })

    return {
      ok: true,
      subscriptionId: subscription.id,
      context: parsed.context,
    }
  }

  return transactionClient ? run(transactionClient) : prisma.$transaction(run)
}

export function createAppHostingFulfillmentAdapter(
  prisma: PrismaClient = defaultPrisma
): BillingFulfillmentAdapter {
  return {
    packageCode: "APP_HOSTING",
    create: async (input, transactionClient) => {
      const result = await applyAppHostingFulfillment(
        prisma,
        input,
        transactionClient
      )
      if (!result.ok) throw new AppHostingFulfillmentError(result.failure)
      return { subscriptionId: result.subscriptionId }
    },
    renew: async (input, transactionClient) => {
      const result = await applyAppHostingFulfillment(
        prisma,
        input,
        transactionClient
      )
      if (!result.ok) throw new AppHostingFulfillmentError(result.failure)
    },
  }
}

export class BillingFulfillmentRegistry {
  private readonly adapters: ReadonlyMap<ServiceType, BillingFulfillmentAdapter>

  constructor(adapters: readonly BillingFulfillmentAdapter[]) {
    const byPackage = new Map<ServiceType, BillingFulfillmentAdapter>()
    for (const adapter of adapters) {
      if (byPackage.has(adapter.packageCode)) {
        throw new Error(`DUPLICATE_FULFILLMENT_ADAPTER:${adapter.packageCode}`)
      }
      byPackage.set(adapter.packageCode, adapter)
    }
    this.adapters = byPackage
  }

  get(packageCode: ServiceType): BillingFulfillmentAdapter {
    const adapter = this.adapters.get(packageCode)
    if (!adapter) throw new Error("FULFILLMENT_NOT_CONFIGURED")
    return adapter
  }
}

export function createBillingFulfillmentRegistry(
  adapters?: readonly BillingFulfillmentAdapter[],
  prisma: PrismaClient = defaultPrisma
): BillingFulfillmentRegistry {
  if (adapters) return new BillingFulfillmentRegistry(adapters)
  return new BillingFulfillmentRegistry([
    createAppHostingFulfillmentAdapter(prisma),
    createVpnFulfillmentAdapter(prisma),
    createWhatsappFulfillmentAdapter(prisma),
  ])
}
