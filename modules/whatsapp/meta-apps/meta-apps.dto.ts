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
