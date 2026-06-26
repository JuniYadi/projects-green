import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import {
  updateBusinessProfileSchema,
  type BusinessProfileFields,
  type UpdateBusinessProfileInput,
} from "@/lib/whatsapp/meta-cloud/types/business-profile"
import {
  DeviceNotFoundError,
  DeviceNotOwnedError,
} from "./devices.schemas"

export class DeviceNoPhoneIdError extends Error {
  readonly code = "DEVICE_NO_PHONE_ID" as const
  constructor() {
    super("Device has no WhatsApp Phone ID linked.")
    this.name = "DeviceNoPhoneIdError"
  }
}

async function getDeviceById(
  deviceId: string,
  organizationId?: string
) {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
  })
  if (!device) throw new DeviceNotFoundError(deviceId)
  if (organizationId && device.organizationId !== organizationId) {
    throw new DeviceNotOwnedError()
  }
  return device
}

function requirePhoneId(
  device: { whatsappPhoneId: string | null; whatsappBusinessAccountId: string | null }
): string {
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
): Promise<BusinessProfileFields | null> {
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
  if (!profile) return null

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

  // Persist to DB
  if (updatedProfile) {
    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        whatsappProfile: updatedProfile as Prisma.InputJsonValue,
      },
    })
  }

  return (updatedProfile ?? data) as BusinessProfileFields
}
