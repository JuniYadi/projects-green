import { prisma } from "@/lib/prisma"
import { encryptWhatsAppToken, decryptWhatsAppToken } from "./crypto"

/**
 * Encrypt a WhatsApp device token and save it to the database.
 */
export async function encryptDeviceToken(deviceId: string, plainToken: string): Promise<void> {
  const encrypted = await encryptWhatsAppToken(plainToken)
  const parts = encrypted.split(".")

  // Format: v1.iv.ciphertext
  const [version, iv, ciphertext] = parts

  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: {
      tokenEncrypted: `${version}.${ciphertext}`,
      tokenIv: iv,
      token: "",
    },
  })
}

/**
 * Decrypt a WhatsApp device token from the database.
 */
export async function decryptDeviceToken(deviceId: string): Promise<string | null> {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    select: {
      tokenEncrypted: true,
      tokenIv: true,
    },
  })

  if (!device || !device.tokenEncrypted || !device.tokenIv) {
    return null
  }

  const encryptedValue = decryptDeviceTokenRaw(device.tokenEncrypted, device.tokenIv)
  return decryptWhatsAppToken(encryptedValue)
}

/**
 * Reconstruct the encrypted token format from separate fields.
 */
export function decryptDeviceTokenRaw(encrypted: string, iv: string): string {
  const [version, ciphertext] = encrypted.split(".")
  return `${version}.${iv}.${ciphertext}`
}

/**
 * Migrate all devices that still have a plain token to encrypted format.
 */
export async function migrateAllTokens(): Promise<{ migrated: number, skipped: number, errors: string[] }> {
  const devices = await prisma.whatsappDevice.findMany({
    where: {
      token: { not: null },
      tokenEncrypted: { equals: null },
    },
  })

  let migrated = 0
  let skipped = 0
  const errors: string[] = []

  for (const device of devices) {
    try {
      if (!device.token) {
        skipped++
        continue
      }

      await encryptDeviceToken(device.id, device.token)
      migrated++
    } catch (error: any) {
      errors.push(`Device ${device.id} (${device.phoneNumber}): ${error.message}`)
    }
  }

  return { migrated, skipped, errors }
}
