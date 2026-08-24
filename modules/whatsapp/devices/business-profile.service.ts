import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import {
  updateBusinessProfileSchema,
  type BusinessProfileFields,
  type UpdateBusinessProfileInput,
} from "@/lib/whatsapp/meta-cloud/types/business-profile"
import { formatTemplateSlug } from "../templates/template-validator"
import { DeviceNotFoundError, DeviceNotOwnedError } from "./devices.schemas"

export class DeviceNoPhoneIdError extends Error {
  readonly code = "DEVICE_NO_PHONE_ID" as const
  constructor() {
    super("Device has no WhatsApp Phone ID linked.")
    this.name = "DeviceNoPhoneIdError"
  }
}

export class DeviceNoMetaAppIdError extends Error {
  readonly code = "DEVICE_NO_META_APP_ID" as const
  constructor() {
    super("Device has no Meta app ID linked for media uploads.")
    this.name = "DeviceNoMetaAppIdError"
  }
}

export class ProfileNotFoundError extends Error {
  readonly code = "PROFILE_NOT_FOUND" as const
  constructor(deviceId: string) {
    super(`Business profile not found for device '${deviceId}'.`)
    this.name = "ProfileNotFoundError"
  }
}

async function getDeviceById(deviceId: string, organizationId?: string) {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    include: { whatsappMetaApp: { select: { metaAppId: true } } },
  })
  if (!device) throw new DeviceNotFoundError(deviceId)
  if (organizationId && device.organizationId !== organizationId) {
    throw new DeviceNotOwnedError()
  }
  return device
}

function requirePhoneId(device: {
  whatsappPhoneId: string | null
  whatsappBusinessAccountId: string | null
}): string {
  if (!device.whatsappPhoneId) throw new DeviceNoPhoneIdError()
  return device.whatsappPhoneId
}

/**
 * Fetch business profile from Meta + merge into local whatsappProfile JSON.
 * Returns the merged profile fields.
 */
export async function getProfile(
  deviceId: string,
  organizationId: string
): Promise<BusinessProfileFields> {
  const device = await getDeviceById(deviceId, organizationId)
  const phoneId = requirePhoneId(device)

  // Create client with device token (works if tokenEncrypted is present)
  const client = await WhatsAppDeviceClient.fromDevice({
    accessToken: device.tokenEncrypted ?? device.token ?? "",
    phoneNumberId: phoneId,
    wabaId: device.whatsappBusinessAccountId ?? "",
    organizationId: device.organizationId,
  })

  const profile = await client.getBusinessProfile()
  if (!profile) throw new ProfileNotFoundError(deviceId)

  // Merge into local JSON column
  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: {
      whatsappProfile: profile as Prisma.InputJsonValue,
    },
  })
  return profile as BusinessProfileFields
}
/**
 * Full sync with Meta Graph API phone_numbers endpoint.
 * Fetches verified name, status, name_status, health, and embedded business profile,
 * and updates prisma.whatsappDevice record.
 */
export async function syncDeviceFromMeta(
  deviceId: string,
  organizationId: string
): Promise<BusinessProfileFields> {
  const device = await getDeviceById(deviceId, organizationId)
  const phoneId = requirePhoneId(device)
  const wabaId = device.whatsappBusinessAccountId
  if (!wabaId) {
    throw new Error("Device has no WhatsApp Business Account ID configured.")
  }

  const rawToken = device.tokenEncrypted ?? device.token ?? ""
  let accessToken = rawToken
  if (device.tokenEncrypted) {
    const parts = device.tokenEncrypted.split(".")
    const decryptable =
      device.tokenIv && parts.length === 2
        ? `${parts[0]}.${device.tokenIv}.${parts[1]}`
        : device.tokenEncrypted
    const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
    accessToken = await decryptWhatsAppToken(decryptable)
  }

  const fields =
    "account_mode,certificate,code_verification_status,conversational_automation,display_phone_number,eligibility_for_api_business_global_search,health_status,id,is_official_business_account,is_on_biz_app,is_pin_enabled,is_preverified_number,last_onboarded_time,messaging_limit_tier,name_status,new_certificate,new_display_name,new_name_status,official_business_account,platform_type,quality_score,search_visibility,status,throughput,verified_name,whatsapp_business_manager_messaging_limit,whatsapp_business_profile.limit(10){about,address,description,email,messaging_product,profile_picture_url,vertical,websites}"

  const version = device.whatsappVersion || "v22.0"
  const url = `https://graph.facebook.com/${version}/${wabaId}/phone_numbers?fields=${fields}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as {
    error?: { message: string }
    data?: Array<Record<string, unknown>>
  }

  if (json.error || !json.data || json.data.length === 0) {
    throw new Error(
      json.error?.message ||
        "No phone number data returned from Meta Graph API."
    )
  }

  const metaPhone = json.data.find((p) => p.id === phoneId) || json.data[0]

  const embeddedProfile =
    (
      metaPhone.whatsapp_business_profile as {
        data?: Array<Record<string, unknown>>
      }
    )?.data?.[0] ?? {}

  const currentProfile =
    device.whatsappProfile &&
    typeof device.whatsappProfile === "object" &&
    !Array.isArray(device.whatsappProfile)
      ? (device.whatsappProfile as Record<string, unknown>)
      : {}

  const websites =
    Array.isArray(embeddedProfile.websites) &&
    embeddedProfile.websites.length > 0
      ? (embeddedProfile.websites as string[])
      : Array.isArray(currentProfile.websites)
        ? (currentProfile.websites as string[])
        : Array.isArray(currentProfile.website)
          ? (currentProfile.website as string[])
          : []

  const mergedProfile: Record<string, unknown> = {
    ...currentProfile,
    about:
      (embeddedProfile.about as string) ||
      (currentProfile.about as string) ||
      "",
    address:
      (embeddedProfile.address as string) ||
      (currentProfile.address as string) ||
      "",
    description:
      (embeddedProfile.description as string) ||
      (currentProfile.description as string) ||
      "",
    email:
      (embeddedProfile.email as string) ||
      (currentProfile.email as string) ||
      "",
    vertical:
      (embeddedProfile.vertical as string) ||
      (currentProfile.vertical as string) ||
      "",
    websites,
    profile_picture_url:
      (embeddedProfile.profile_picture_url as string) ||
      (currentProfile.profile_picture_url as string) ||
      (currentProfile.profilePicture as string) ||
      "",
    verified_name:
      (metaPhone.verified_name as string) ||
      (currentProfile.verified_name as string) ||
      "",
    name_status:
      (metaPhone.name_status as string) ||
      (currentProfile.name_status as string) ||
      "APPROVED",
    new_display_name: metaPhone.new_display_name ?? null,
    new_name_status: metaPhone.new_name_status ?? null,
    quality_rating:
      (metaPhone.quality_score as { score?: string })?.score ?? "GREEN",
    display_phone_number:
      (metaPhone.display_phone_number as string) || device.phoneNumber,
    is_official_business_account:
      metaPhone.is_official_business_account ?? false,
    messaging_limit_tier:
      metaPhone.whatsapp_business_manager_messaging_limit ??
      metaPhone.messaging_limit_tier ??
      null,
    meta_health_status: metaPhone.health_status ?? null,
  }

  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: {
      whatsappProfile: mergedProfile as Prisma.InputJsonValue,
      lastHeartbeatAt: new Date(),
    },
  })

  return mergedProfile as BusinessProfileFields
}

/**
 * Pull/Sync all message templates from Meta Graph API for a specific device into the database.
 */
export async function syncTemplatesFromMeta(
  deviceId: string,
  organizationId: string
): Promise<{ syncedCount: number; totalMetaCount: number }> {
  const device = await getDeviceById(deviceId, organizationId)
  const wabaId = device.whatsappBusinessAccountId
  if (!wabaId) {
    throw new Error("Device has no WhatsApp Business Account ID configured.")
  }

  const rawToken = device.tokenEncrypted ?? device.token ?? ""
  let accessToken = rawToken
  if (device.tokenEncrypted) {
    const parts = device.tokenEncrypted.split(".")
    const decryptable =
      device.tokenIv && parts.length === 2
        ? `${parts[0]}.${device.tokenIv}.${parts[1]}`
        : device.tokenEncrypted
    const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
    accessToken = await decryptWhatsAppToken(decryptable)
  }

  const version = device.whatsappVersion || "v22.0"
  const baseUrl = new URL(
    `https://graph.facebook.com/${version}/${wabaId}/message_templates`
  )
  baseUrl.searchParams.set(
    "fields",
    "name,language,status,category,components,rejected_reason"
  )
  baseUrl.searchParams.set("limit", "100")

  type MetaTemplate = {
    id: string
    name: string
    language: string
    status: string
    category: string
    components?: Array<Record<string, unknown>>
    rejected_reason?: string
  }

  const allMetaTemplates: MetaTemplate[] = []
  let after: string | undefined

  do {
    const pageUrl = new URL(baseUrl)
    if (after) {
      pageUrl.searchParams.set("after", after)
    }

    const res = await fetch(pageUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json()) as {
      error?: { message: string }
      data?: MetaTemplate[]
      paging?: {
        cursors?: { after?: string }
        next?: string
      }
    }

    if (json.error || !json.data) {
      throw new Error(
        json.error?.message || "Failed to fetch templates from Meta Graph API."
      )
    }

    allMetaTemplates.push(...json.data)
    after = json.paging?.next ? json.paging.cursors?.after : undefined
  } while (after)

  const metaStatusMap: Record<string, "APPROVED" | "PENDING" | "REJECTED"> = {
    APPROVED: "APPROVED",
    PENDING: "PENDING",
    PENDING_REVIEW: "PENDING",
    REJECTED: "REJECTED",
    DECLINED: "REJECTED",
  }

  const categoryMap: Record<
    string,
    "MARKETING" | "UTILITY" | "AUTHENTICATION"
  > = {
    MARKETING: "MARKETING",
    UTILITY: "UTILITY",
    AUTHENTICATION: "AUTHENTICATION",
    AUTH: "AUTHENTICATION",
  }

  let syncedCount = 0

  for (const metaTpl of allMetaTemplates) {
    const metaStatus = metaStatusMap[metaTpl.status.toUpperCase()] ?? "PENDING"
    const category = categoryMap[metaTpl.category.toUpperCase()] ?? "UTILITY"
    const lang = metaTpl.language || "en_US"

    // Extract header, body, footer, buttons from components
    const comps = metaTpl.components || []
    const headerComp = comps.find((c) => c.type === "HEADER")
    const bodyComp = comps.find((c) => c.type === "BODY")
    const footerComp = comps.find((c) => c.type === "FOOTER")
    const buttonComp = comps.find((c) => c.type === "BUTTONS")

    const headerType =
      (headerComp?.format as string) || (headerComp ? "TEXT" : null)
    const headerText = (headerComp?.text as string) || null
    const headerUrl =
      (headerComp?.example as { header_handle?: string[] })
        ?.header_handle?.[0] || null
    const body = (bodyComp?.text as string) || ""
    const footer = (footerComp?.text as string) || null
    const buttons = buttonComp?.buttons || null

    const isApproved = metaStatus === "APPROVED"
    const rejectReason =
      metaTpl.rejected_reason !== "NONE" ? metaTpl.rejected_reason : null

    // Find or create template by (organizationId, whatsappDeviceId, canonical slug / name)
    const canonicalSlug = formatTemplateSlug(metaTpl.name)
    const hyphenatedSlug = metaTpl.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    const possibleSlugs = Array.from(
      new Set([canonicalSlug, metaTpl.name, hyphenatedSlug].filter(Boolean))
    )

    let template = await prisma.whatsappTemplate.findFirst({
      where: {
        organizationId,
        whatsappDeviceId: deviceId,
        OR: [
          { slug: { in: possibleSlugs } },
          { name: metaTpl.name },
        ],
      },
      include: {
        languages: {
          where: { lang },
        },
      },
    })

    if (!template) {
      template = await prisma.whatsappTemplate.create({
        data: {
          organizationId,
          whatsappDeviceId: deviceId,
          slug: canonicalSlug || metaTpl.name,
          name: metaTpl.name,
          category,
          syncStatus: "SYNCED",
          metaStatus,
          lastSyncedAt: new Date(),
        },
        include: {
          languages: true,
        },
      })
    } else {
      // Dirty check on parent template: only update if metaStatus/category changed
      const isTemplateDirty =
        template.metaStatus !== metaStatus ||
        template.category !== category ||
        template.syncStatus !== "SYNCED"

      if (isTemplateDirty) {
        template = await prisma.whatsappTemplate.update({
          where: { id: template.id },
          data: {
            slug: canonicalSlug || metaTpl.name,
            category,
            syncStatus: "SYNCED",
            metaStatus,
            lastSyncedAt: new Date(),
          },
          include: {
            languages: {
              where: { lang },
            },
          },
        })
      }
    }

    // Language dirty check
    const existingLang = template.languages?.[0]
    if (!existingLang) {
      await prisma.whatsappTemplateLanguage.create({
        data: {
          templateId: template.id,
          lang,
          headerType,
          headerText,
          headerUrl,
          body,
          footer,
          buttons: buttons as Prisma.InputJsonValue,
          isApproved,
          metaStatus,
          rejectReason,
        },
      })
    } else {
      const isLangDirty =
        existingLang.metaStatus !== metaStatus ||
        existingLang.rejectReason !== rejectReason ||
        existingLang.isApproved !== isApproved ||
        existingLang.headerType !== headerType ||
        existingLang.headerText !== headerText ||
        existingLang.headerUrl !== headerUrl ||
        existingLang.body !== body ||
        existingLang.footer !== footer ||
        JSON.stringify(existingLang.buttons) !== JSON.stringify(buttons)

      if (isLangDirty) {
        await prisma.whatsappTemplateLanguage.update({
          where: { id: existingLang.id },
          data: {
            headerType,
            headerText,
            headerUrl,
            body,
            footer,
            buttons: buttons as Prisma.InputJsonValue,
            isApproved,
            metaStatus,
            rejectReason,
          },
        })
      }
    }

    syncedCount++
  }

  return { syncedCount, totalMetaCount: allMetaTemplates.length }
}
/**
 * Update business profile in Meta + persist to local whatsappProfile JSON.
 * Sends only the provided fields (partial update).
 */
export async function updateProfile(
  deviceId: string,
  data: UpdateBusinessProfileInput,
  organizationId: string
): Promise<BusinessProfileFields> {
  const device = await getDeviceById(deviceId, organizationId)
  const phoneId = requirePhoneId(device)

  // Strip undefined keys — Meta rejects unknown fields but partial = send only what's provided
  // ponytail: Object.fromEntries + filter — no custom strip helper needed
  const body = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  )

  const client = await WhatsAppDeviceClient.fromDevice({
    accessToken: device.tokenEncrypted ?? device.token ?? "",
    phoneNumberId: phoneId,
    wabaId: device.whatsappBusinessAccountId ?? "",
    organizationId: device.organizationId,
  })

  const result = await client.updateBusinessProfile(body)
  if (!result.success) {
    throw new Error("Meta returned success: false for profile update")
  }

  // Fetch fresh profile from Meta after update
  const updatedProfile = await client.getBusinessProfile()

  if (!updatedProfile) throw new ProfileNotFoundError(deviceId)

  // Persist to DB
  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: {
      whatsappProfile: updatedProfile as Prisma.InputJsonValue,
    },
  })

  return updatedProfile as BusinessProfileFields
}

export async function uploadProfilePicture(
  deviceId: string,
  file: {
    data: ArrayBuffer
    mimeType: string
    fileName: string
  },
  organizationId: string
): Promise<BusinessProfileFields> {
  const device = await getDeviceById(deviceId, organizationId)
  const phoneId = requirePhoneId(device)
  const metaAppId =
    device.whatsappMetaApp?.metaAppId ?? device.whatsappApplicationId

  if (!metaAppId) throw new DeviceNoMetaAppIdError()

  const client = await WhatsAppDeviceClient.fromDevice({
    accessToken: device.tokenEncrypted ?? device.token ?? "",
    phoneNumberId: phoneId,
    wabaId: device.whatsappBusinessAccountId ?? "",
    metaAppId,
    organizationId: device.organizationId,
  })

  const { handle } = await client.uploadProfilePicture(file)
  const result = await client.updateBusinessProfile({
    messaging_product: "whatsapp",
    profile_picture_handle: handle,
  })

  if (!result.success) {
    throw new Error("Meta returned success: false for profile picture update")
  }

  const updatedProfile = await client.getBusinessProfile()
  if (!updatedProfile) throw new ProfileNotFoundError(deviceId)

  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: {
      whatsappProfile: updatedProfile as Prisma.InputJsonValue,
    },
  })

  return updatedProfile as BusinessProfileFields
}
