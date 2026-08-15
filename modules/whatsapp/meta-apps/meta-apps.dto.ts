import { Prisma, type WhatsappMetaApp } from "@prisma/client"

export type WhatsappMetaAppDTO = Pick<
  WhatsappMetaApp,
  | "id"
  | "name"
  | "metaAppId"
  | "webhookKey"
  | "active"
  | "createdAt"
  | "updatedAt"
> & {
  callbackPath: string
}

export function toWhatsappMetaAppDTO(
  app: Pick<
    Prisma.WhatsappMetaAppGetPayload<Prisma.WhatsappMetaAppDefaultArgs>,
    | "id"
    | "name"
    | "metaAppId"
    | "webhookKey"
    | "active"
    | "createdAt"
    | "updatedAt"
  >
): WhatsappMetaAppDTO {
  return {
    id: app.id,
    name: app.name,
    metaAppId: app.metaAppId,
    webhookKey: app.webhookKey,
    active: app.active,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    callbackPath: `/api/whatsapp/meta-webhook/${app.webhookKey}`,
  }
}

export type WhatsappMetaAppListItemDTO = WhatsappMetaAppDTO & {
  deviceCount: number
}

export function toWhatsappMetaAppListItemDTO(
  app: Prisma.WhatsappMetaAppGetPayload<{
    include: { _count: { select: { devices: true } } }
  }>
): WhatsappMetaAppListItemDTO {
  return {
    ...toWhatsappMetaAppDTO(app),
    deviceCount: app._count.devices,
  }
}
