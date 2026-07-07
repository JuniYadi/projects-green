import { Prisma } from "@prisma/client"

export type WhatsappTemplateLanguageDTO = Pick<
  Prisma.WhatsappTemplateLanguageGetPayload<Prisma.WhatsappTemplateLanguageDefaultArgs>,
  | "id"
  | "lang"
  | "headerType"
  | "headerUrl"
  | "headerText"
  | "body"
  | "parameters"
  | "footer"
  | "buttons"
  | "isApproved"
  | "metaStatus"
  | "rejectReason"
  | "createdAt"
  | "updatedAt"
>

export type WhatsappTemplateDTO = Pick<
  Prisma.WhatsappTemplateGetPayload<Prisma.WhatsappTemplateDefaultArgs>,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "organizationId"
  | "whatsappDeviceId"
  | "syncStatus"
  | "metaStatus"
  | "lastSyncedAt"
  | "createdAt"
  | "updatedAt"
  | "category"
> & {
  languages?: WhatsappTemplateLanguageDTO[]
}

type TemplateWithLanguages = Prisma.WhatsappTemplateGetPayload<{
  include: { languages: true }
}>

function toWhatsappTemplateLanguageDTO(
  language: Prisma.WhatsappTemplateLanguageGetPayload<Prisma.WhatsappTemplateLanguageDefaultArgs>
): WhatsappTemplateLanguageDTO {
  return {
    id: language.id,
    lang: language.lang,
    headerType: language.headerType,
    headerUrl: language.headerUrl,
    headerText: language.headerText,
    body: language.body,
    parameters: language.parameters,
    footer: language.footer,
    buttons: language.buttons,
    isApproved: language.isApproved,
    metaStatus: language.metaStatus,
    rejectReason: language.rejectReason,
    createdAt: language.createdAt,
    updatedAt: language.updatedAt,
  }
}

export function toWhatsappTemplateDTO(
  template:
    | Prisma.WhatsappTemplateGetPayload<Prisma.WhatsappTemplateDefaultArgs>
    | TemplateWithLanguages
): WhatsappTemplateDTO {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    organizationId: template.organizationId,
    whatsappDeviceId: template.whatsappDeviceId,
    syncStatus: template.syncStatus,
    metaStatus: template.metaStatus,
    lastSyncedAt: template.lastSyncedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    category: template.category,
    languages:
      "languages" in template
        ? template.languages.map(toWhatsappTemplateLanguageDTO)
        : undefined,
  }
}
