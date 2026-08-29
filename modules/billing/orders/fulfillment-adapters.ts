import { Prisma, type PrismaClient, type ServiceType } from "@prisma/client"
import { z } from "zod"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"
import { VaultClient } from "@/lib/vault/vault-client"
import { claimManagedStock } from "@/modules/deploy/app-managed-stock.service"
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

  if (raw === null) {
    return {
      ok: true,
      context: {
        stackId: "standalone",
        deploymentId: "standalone",
        sourceType: "TEMPLATE",
        resourcePlanId: "starter",
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

type ManagedStockRecord = {
  id: string
  serviceType: string
  vaultPath: string
}

type AppHostingAdapterDependencies = {
  claimStock?: (input: {
    orgId: string
    stackId: string
    serviceType: string
    environment: string
  }) => Promise<ManagedStockRecord>
  vault?: Pick<VaultClient, "writeKV"> & Partial<Pick<VaultClient, "readKV">>
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
    resources?: Prisma.JsonValue
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

function _jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

function metadataObject(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function recordResource(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function provisioningResource(value: unknown): Record<string, unknown> {
  const raw = recordResource(value)
  return recordResource(raw.provisioning ?? raw)
}

function stringResources(
  resources: Record<string, unknown>,
  key: string
): string[] {
  const value = resources[key]
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  )
}

function provisioningUsername(
  metadata: Record<string, unknown>,
  organizationId: string,
  fallback: (organizationId: string) => string
): string {
  const answers = metadata.provisioningAnswers
  if (answers && typeof answers === "object" && !Array.isArray(answers)) {
    const username = (answers as Record<string, unknown>).username
    if (typeof username === "string" && username.trim()) return username.trim()
  }
  return fallback(organizationId)
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
  metadata: Record<string, unknown>,
  existing?: ServiceSubscriptionRecord | null
): Prisma.ServiceSubscriptionUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    packageId: pricing.servicePlan.packageId,
    planId: input.planId,
    pricingId: pricing.id,
    type: pricing.type,
    billingMode: pricing.billingMode,
    billingPeriod: pricing.billingPeriod,
    priceLocked:
      input.unitPrice ??
      (existing as { priceLocked?: Prisma.Decimal | null } | null | undefined)
        ?.priceLocked ??
      pricing.periodPrice ??
      new Prisma.Decimal(0),
    currency: pricing.currency,
    quantity: input.quantity ?? new Prisma.Decimal(1),
    status: "ACTIVE",
    currentPeriodStart: input.periodStart,
    currentPeriodEnd: input.periodEnd,
    allocatedConfig: (metadata.provisioningAnswers ??
      metadata.allocatedConfig ??
      metadata) as Prisma.InputJsonValue,
    metadata: metadata as Prisma.InputJsonValue,
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
  const data = subscriptionData(
    input,
    pricing,
    {
      ...metadataObject(existing?.metadata),
      ...metadata,
    },
    existing
  )
  return existing
    ? tx.serviceSubscription.update({ where: { id: existing.id }, data })
    : tx.serviceSubscription.create({
        data: {
          ...data,
          commitmentEndsAt: commitmentEndsAt(pricing, input.periodStart),
        },
      })
}

function enabledProtocols(
  server: VpnPackageRecord["servers"][number]["server"],
  allowedProtocols?: ReadonlySet<string>
): Array<"OPENVPN" | "WIREGUARD" | "PROXY"> {
  return [
    server.hasOpenVpn ? "OPENVPN" : null,
    server.hasWireGuard ? "WIREGUARD" : null,
    server.hasProxy ? "PROXY" : null,
  ].filter(
    (protocol): protocol is "OPENVPN" | "WIREGUARD" | "PROXY" =>
      protocol !== null &&
      (allowedProtocols === undefined || allowedProtocols.has(protocol))
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
  let vpnPackage = (await tx.vpnPackage.findFirst({
    where: {
      servicePlanId: input.planId,
    } as unknown as Prisma.VpnPackageWhereInput,
    include: { servers: { include: { server: true } } },
  })) as VpnPackageRecord | null

  // If plan was created via dynamic Global Catalog, auto-create matching VpnPackage row
  if (!vpnPackage && tx.vpnPackage?.create) {
    const plan = pricing.servicePlan
    const resources = provisioningResource(plan.resources)
    const serverIds = stringResources(resources, "serverIds")
    if (serverIds.length > 0) {
      const activeServers = tx.vpnServer?.findMany
        ? await tx.vpnServer.findMany({
            where: { id: { in: serverIds }, isActive: true },
            select: { id: true },
          })
        : []

      vpnPackage = (await tx.vpnPackage.create({
        data: {
          name:
            ("name" in plan && typeof plan.name === "string"
              ? plan.name
              : undefined) ?? "VPN Plan",
          servicePlanId: plan.id,
          price: input.unitPrice,
          currency: input.currency,
          isActive:
            ("isActive" in plan && typeof plan.isActive === "boolean"
              ? plan.isActive
              : undefined) ?? true,
          servers: {
            create: activeServers.map((s) => ({ serverId: s.id })),
          },
        },
        include: { servers: { include: { server: true } } },
      })) as VpnPackageRecord
    }
  }

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

  const resources = provisioningResource(pricing.servicePlan.resources)
  const configuredServerIds = stringResources(resources, "serverIds")
  const configuredProtocols = stringResources(
    resources,
    "allowedProtocols"
  ).map((protocol) => protocol.toUpperCase())
  const serverIds =
    configuredServerIds.length > 0 ? new Set(configuredServerIds) : null
  const allowedProtocols =
    configuredProtocols.length > 0 ? new Set(configuredProtocols) : undefined
  const resourceServers =
    configuredServerIds.length > 0 && tx.vpnServer?.findMany
      ? await tx.vpnServer.findMany({
          where: {
            id: { in: configuredServerIds },
            isActive: true,
          },
          select: {
            id: true,
            hasOpenVpn: true,
            hasWireGuard: true,
            hasProxy: true,
          },
        })
      : null
  const selectedServers =
    resourceServers && resourceServers.length > 0
      ? resourceServers.map((server) => ({ server }))
      : vpnPackage.servers.filter(
          ({ server }) => serverIds === null || serverIds.has(server.id)
        )
  const accountUsername = provisioningUsername(
    metadata,
    input.organizationId,
    username
  )
  const existingAccounts = new Map(
    (existingVpn?.serverAccounts ?? []).map((account) => [
      `${account.serverId}:${account.protocol}`,
      account,
    ])
  )
  const accountIds: string[] = []
  for (const entry of selectedServers) {
    for (const protocol of enabledProtocols(entry.server, allowedProtocols)) {
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
          username: accountUsername,
          provisioningStatus: "PENDING",
        },
      })
      if (tx.serviceProvisionAccount) {
        await tx.serviceProvisionAccount.create({
          data: {
            subscriptionId: serviceSubscription.id,
            serviceType: "VPN",
            targetId: entry.server.id,
            identifier: accountUsername,
            status: "PENDING",
            metadata: _jsonObject({
              protocol,
              serverAccountId: account.id,
              serverId: entry.server.id,
            }),
          },
        })
      }
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

type WhatsappDeviceInput = {
  phoneNumber?: string
  name?: string
  displayName?: string
  profilePictureUrl?: string
}

function extractNewDeviceMetadata(
  metadata: Record<string, unknown>
): WhatsappDeviceInput | null {
  const raw =
    typeof metadata.device === "object" && metadata.device !== null
      ? (metadata.device as Record<string, unknown>)
      : metadata

  const phoneNumber =
    typeof raw.phoneNumber === "string" && raw.phoneNumber.trim().length > 0
      ? raw.phoneNumber.trim()
      : typeof raw.phone === "string" && raw.phone.trim().length > 0
        ? raw.phone.trim()
        : undefined

  if (!phoneNumber) return null

  const displayName =
    typeof raw.displayName === "string" && raw.displayName.trim().length > 0
      ? raw.displayName.trim()
      : typeof raw.name === "string" && raw.name.trim().length > 0
        ? raw.name.trim()
        : undefined

  const profilePictureUrl =
    typeof raw.profilePictureUrl === "string" &&
    raw.profilePictureUrl.trim().length > 0
      ? raw.profilePictureUrl.trim()
      : undefined

  return {
    phoneNumber,
    displayName,
    profilePictureUrl,
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

    const newDevice = extractNewDeviceMetadata(metadata)
    if (newDevice && newDevice.phoneNumber) {
      const phoneNumber = newDevice.phoneNumber
      const planResources = provisioningResource(pricing.servicePlan.resources)
      const planQuota =
        typeof planResources.quota === "number" ||
        typeof planResources.quota === "string"
          ? new Prisma.Decimal(String(planResources.quota))
          : new Prisma.Decimal(1000)

      // Create pending / non-active device
      const createdDevice = await tx.whatsappDevice.upsert({
        where: { phoneNumber },
        create: {
          organizationId: input.organizationId,
          phoneNumber,
          status: "NON_ACTIVE",
          quotaBase: planQuota,
          quotaBaseOut: planQuota,
          whatsappProfile:
            newDevice.displayName || newDevice.profilePictureUrl
              ? {
                  name: newDevice.displayName,
                  profile_picture_url: newDevice.profilePictureUrl,
                }
              : undefined,
        },
        update: {
          organizationId: input.organizationId,
          quotaBase: planQuota,
          quotaBaseOut: planQuota,
        },
      })

      const serviceSubscription = await upsertServiceSubscription(
        tx,
        input,
        pricing,
        {
          ...metadata,
          deviceIds: [createdDevice.id],
          allowanceByDevice: { [createdDevice.id]: planQuota.toString() },
        }
      )
      return serviceSubscription.id
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
  transactionClient?: Prisma.TransactionClient,
  dependencies: AppHostingAdapterDependencies = {}
): Promise<AppHostingFulfillmentResult> {
  const parsed = parseAppHostingFulfillmentContext(input.metadata)
  if (!parsed.ok) throw new AppHostingFulfillmentError(parsed.failure)

  const claimStock =
    dependencies.claimStock ??
    (claimManagedStock as AppHostingAdapterDependencies["claimStock"])
  const vault = dependencies.vault ?? new VaultClient()
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
    const resources = provisioningResource(pricing.servicePlan.resources)
    const dependenciesToClaim = stringResources(
      resources,
      "requiredDependencies"
    ).map((dependency) => dependency.toUpperCase())
    const subscription = await upsertServiceSubscription(tx, input, pricing, {
      [APP_HOSTING_FULFILLMENT_METADATA_KEY]: parsed.context,
    })
    const environment =
      typeof input.metadata.environment === "string"
        ? input.metadata.environment
        : "production"

    const tenantVaultPath = `tenants/${input.organizationId}/stacks/${parsed.context.stackId}/prod/app-env`
    const allCredentials: Record<string, string> = {}

    for (const dependency of dependenciesToClaim) {
      if (!claimStock) continue
      const stock = await claimStock({
        orgId: input.organizationId,
        stackId: parsed.context.stackId,
        serviceType: dependency,
        environment,
      })
      const adminStockVaultPath = `admin/managed-stock/${stock.id}`
      const credentials = vault.readKV
        ? await vault.readKV(stock.vaultPath || adminStockVaultPath)
        : {}
      for (const [key, value] of Object.entries(credentials)) {
        if (typeof value === "string") {
          allCredentials[key] = value
        }
      }

      if (tx.serviceProvisionAccount) {
        await tx.serviceProvisionAccount.create({
          data: {
            subscriptionId: subscription.id,
            serviceType: "APP_HOSTING",
            targetId: stock.id,
            identifier: dependency,
            status: "PENDING",
            vaultPath: tenantVaultPath,
            metadata: _jsonObject({
              dependency,
              stockId: stock.id,
              compute: resources.compute,
              networking: resources.networking,
            }),
          },
        })
      }
    }

    if (Object.keys(allCredentials).length > 0 && vault.writeKV) {
      await vault.writeKV(tenantVaultPath, allCredentials)
    }

    return {
      ok: true,
      subscriptionId: subscription.id,
      context: parsed.context,
    }
  }

  return transactionClient ? run(transactionClient) : prisma.$transaction(run)
}

export function createAppHostingFulfillmentAdapter(
  prisma: PrismaClient = defaultPrisma,
  dependencies: AppHostingAdapterDependencies = {}
): BillingFulfillmentAdapter {
  return {
    packageCode: "APP_HOSTING",
    create: async (input, transactionClient) => {
      const result = await applyAppHostingFulfillment(
        prisma,
        input,
        transactionClient,
        dependencies
      )
      if (!result.ok) throw new AppHostingFulfillmentError(result.failure)
      return { subscriptionId: result.subscriptionId }
    },
    renew: async (input, transactionClient) => {
      const result = await applyAppHostingFulfillment(
        prisma,
        input,
        transactionClient,
        dependencies
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
