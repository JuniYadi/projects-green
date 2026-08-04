import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient, type WhatsappDevice } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { decryptWithAppKey, encryptWithAppKey } from "@/lib/whatsapp/crypto"

import { toWhatsappMetaAppDTO, type WhatsappMetaAppDTO } from "./meta-apps.dto"
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

export class MetaAppsService {
  constructor(private readonly database: PrismaClient = prisma) {}

  async create(input: CreateMetaAppInput): Promise<WhatsappMetaAppDTO> {
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

    return toWhatsappMetaAppDTO(app)
  }

  async list(options: MetaAppListOptions = {}): Promise<WhatsappMetaAppDTO[]> {
    const apps = await this.database.whatsappMetaApp.findMany({
      where: options.activeOnly === false ? {} : { active: true },
      orderBy: { createdAt: "desc" },
    })
    return apps.map(toWhatsappMetaAppDTO)
  }

  async get(id: string): Promise<WhatsappMetaAppDTO | null> {
    const app = await this.database.whatsappMetaApp.findUnique({
      where: { id },
    })
    return app ? toWhatsappMetaAppDTO(app) : null
  }

  async update(
    id: string,
    input: UpdateMetaAppInput
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
    return toWhatsappMetaAppDTO(app)
  }

  async rotateCredentials(
    id: string,
    credentials: Pick<UpdateMetaAppInput, "appSecret" | "verifyToken">
  ): Promise<WhatsappMetaAppDTO> {
    return this.update(id, credentials)
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

  async delete(id: string): Promise<WhatsappMetaAppDTO | null> {
    const app = await this.withNoDevicesLock(id, (tx) =>
      tx.whatsappMetaApp.delete({ where: { id } })
    )
    return app ? toWhatsappMetaAppDTO(app) : null
  }

  private async withNoDevicesLock<T>(
    id: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "WhatsappMetaApp" WHERE id = ${id} FOR UPDATE`
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
