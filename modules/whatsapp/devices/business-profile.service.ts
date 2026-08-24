import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import {
  updateBusinessProfileSchema,
  type BusinessProfileFields,
  type UpdateBusinessProfileInput,
} from "@/lib/whatsapp/meta-cloud/types/business-profile"
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
