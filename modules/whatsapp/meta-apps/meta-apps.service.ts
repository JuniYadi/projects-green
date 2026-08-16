import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient, type WhatsappDevice } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { decryptWithAppKey, encryptWithAppKey } from "@/lib/whatsapp/crypto"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

import {
  toWhatsappMetaAppDTO,
  toWhatsappMetaAppListItemDTO,
  type WhatsappMetaAppDTO,
  type WhatsappMetaAppListItemDTO,
} from "./meta-apps.dto"
import {
  createMetaAppSchema,
  updateMetaAppSchema,
  type CreateMetaAppInput,
  type UpdateMetaAppInput,
} from "./meta-apps.schemas"

function isForeignKeyConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  )
}

export class MetaAppConflictError extends Error {
  readonly code = "META_APP_HAS_DEVICES"

  constructor() {
    super(
      "Meta app cannot be deactivated or deleted while devices are attached"
    )
    this.name = "MetaAppConflictError"
  }
}

export type ResolvedMetaAppCredentials = {
  id: string
  name: string
  metaAppId: string
  webhookKey: string
  active: boolean
  appSecret: string
  verifyToken: string
}

export type MetaAppListOptions = {
  activeOnly?: boolean
}

// Meta apps are platform-scoped, while audit rows require an organization key.
const META_APP_AUDIT_ORGANIZATION_ID = "system"
const META_APP_AUDIT_FIELDS = [
  "name",
  "metaAppId",
  "appSecret",
  "verifyToken",
  "active",
] as const

type MetaAppAuditField = (typeof META_APP_AUDIT_FIELDS)[number]

function getChangedFields(
  input: Partial<Record<MetaAppAuditField, unknown>>
): MetaAppAuditField[] {
  return META_APP_AUDIT_FIELDS.filter((field) => input[field] !== undefined)
}

export class MetaAppsService {
  constructor(private readonly database: PrismaClient = prisma) {}

  async create(
    input: CreateMetaAppInput,
    actorId: string
  ): Promise<WhatsappMetaAppDTO> {
    const data = createMetaAppSchema.parse(input)
    const [appSecretEncrypted, verifyTokenEncrypted] = await Promise.all([
      encryptWithAppKey(data.appSecret),
      encryptWithAppKey(data.verifyToken),
    ])

    const app = await this.database.whatsappMetaApp.create({
      data: {
        name: data.name,
        metaAppId: data.metaAppId,
        appSecretEncrypted,
        verifyTokenEncrypted,
        webhookKey: randomBytes(32).toString("base64url"),
        active: data.active,
      },
    })

    await logWhatsappAuditEvent({
      action: "META_APP_CREATED",
      status: "OK",
      organizationId: META_APP_AUDIT_ORGANIZATION_ID,
      adminId: actorId,
      message: "WhatsApp Meta app created.",
      details: {
        metaAppId: app.metaAppId,
        changedFields: getChangedFields(data),
      },
    })

    return toWhatsappMetaAppDTO(app)
  }

  async list(
    options: MetaAppListOptions = {}
  ): Promise<WhatsappMetaAppListItemDTO[]> {
    const apps = await this.database.whatsappMetaApp.findMany({
      where: options.activeOnly === false ? {} : { active: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { devices: true } } },
    })
    return apps.map(toWhatsappMetaAppListItemDTO)
  }

  async get(id: string): Promise<WhatsappMetaAppDTO | null> {
    const app = await this.database.whatsappMetaApp.findUnique({
      where: { id },
    })
    return app ? toWhatsappMetaAppDTO(app) : null
  }

  async update(
    id: string,
    input: UpdateMetaAppInput,
    actorId: string
  ): Promise<WhatsappMetaAppDTO> {
    const data = updateMetaAppSchema.parse(input)
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.metaAppId !== undefined) updateData.metaAppId = data.metaAppId
    if (data.active !== undefined) updateData.active = data.active
    if (data.appSecret !== undefined) {
      updateData.appSecretEncrypted = await encryptWithAppKey(data.appSecret)
    }
    if (data.verifyToken !== undefined) {
      updateData.verifyTokenEncrypted = await encryptWithAppKey(
        data.verifyToken
      )
    }

    const app =
      data.active === false
        ? await this.withNoDevicesLock(id, (tx) =>
            tx.whatsappMetaApp.update({ where: { id }, data: updateData })
          )
        : await this.database.whatsappMetaApp.update({
            where: { id },
            data: updateData,
          })
    const credentialsChanged =
      data.appSecret !== undefined || data.verifyToken !== undefined
    await logWhatsappAuditEvent({
      action: credentialsChanged
        ? "META_APP_CREDENTIALS_ROTATED"
        : "META_APP_UPDATED",
      status: "OK",
      organizationId: META_APP_AUDIT_ORGANIZATION_ID,
      adminId: actorId,
      message: credentialsChanged
        ? "WhatsApp Meta app credentials rotated."
        : "WhatsApp Meta app updated.",
      details: {
        metaAppId: app.metaAppId,
        changedFields: getChangedFields(data),
      },
    })

    return toWhatsappMetaAppDTO(app)
  }

  async rotateCredentials(
    id: string,
    credentials: Pick<UpdateMetaAppInput, "appSecret" | "verifyToken">,
    actorId: string
  ): Promise<WhatsappMetaAppDTO> {
    return this.update(id, credentials, actorId)
  }

  async resolveCredentialsByWebhookKey(
    webhookKey: string
  ): Promise<ResolvedMetaAppCredentials | null> {
    const app = await this.database.whatsappMetaApp.findUnique({
      where: { webhookKey },
    })
    if (!app || !app.active) return null

    try {
      const [appSecret, verifyToken] = await Promise.all([
        decryptWithAppKey(app.appSecretEncrypted),
        decryptWithAppKey(app.verifyTokenEncrypted),
      ])
      if (
        typeof appSecret !== "string" ||
        appSecret.length === 0 ||
        typeof verifyToken !== "string" ||
        verifyToken.length === 0
      ) {
        return null
      }
      return {
        id: app.id,
        name: app.name,
        metaAppId: app.metaAppId,
        webhookKey: app.webhookKey,
        active: app.active,
        appSecret,
        verifyToken,
      }
    } catch {
      return null
    }
  }

  async resolveDeviceByPhoneId(
    whatsappMetaAppId: string,
    whatsappPhoneId: string
  ): Promise<WhatsappDevice | null> {
    return this.database.whatsappDevice.findFirst({
      where: { whatsappMetaAppId, whatsappPhoneId },
    })
  }

  async deactivate(id: string): Promise<WhatsappMetaAppDTO | null> {
    const app = await this.withNoDevicesLock(id, (tx) =>
      tx.whatsappMetaApp.update({
        where: { id },
        data: { active: false },
      })
    )
    return app ? toWhatsappMetaAppDTO(app) : null
  }

  async delete(
    id: string,
    actorId: string
  ): Promise<WhatsappMetaAppDTO | null> {
    const app = await this.withNoDevicesLock(id, (tx) =>
      tx.whatsappMetaApp.delete({ where: { id } })
    )
    if (!app) return null

    await logWhatsappAuditEvent({
      action: "META_APP_DELETED",
      status: "OK",
      organizationId: META_APP_AUDIT_ORGANIZATION_ID,
      adminId: actorId,
      message: "WhatsApp Meta app deleted.",
      details: {
        metaAppId: app.metaAppId,
        changedFields: [],
      },
    })

    return toWhatsappMetaAppDTO(app)
  }

  private async withNoDevicesLock<T>(
    id: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "WhatsappMetaApp" WHERE id = ${id} FOR UPDATE NOWAIT`
      )
      const deviceCount = await tx.whatsappDevice.count({
        where: { whatsappMetaAppId: id },
      })
      if (deviceCount > 0) throw new MetaAppConflictError()

      try {
        return await operation(tx)
      } catch (error) {
        if (isForeignKeyConflict(error)) throw new MetaAppConflictError()
        throw error
      }
    })
  }
}

export const metaAppsService = new MetaAppsService()
