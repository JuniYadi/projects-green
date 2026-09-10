import { decryptWhatsAppToken } from "@/lib/whatsapp/crypto"

export class DeviceTokenRequiredError extends Error {
  readonly code = "DEVICE_TOKEN_REQUIRED" as const
  constructor() {
    super(
      "WhatsApp device has no access token configured and its linked Meta app has no default system token."
    )
    this.name = "DeviceTokenRequiredError"
  }
}

export type DeviceWithMetaApp = {
  token?: string | null
  tokenEncrypted?: string | null
  tokenIv?: string | null
  whatsappVersion?: string | null
  whatsappBusinessAccountId?: string | null
  whatsappPhoneId?: string | null
  whatsappMetaApp?: {
    metaAppId?: string | null
    name?: string | null
    systemTokenEncrypted?: string | null
    defaultVersion?: string | null
  } | null
}

export type EffectiveDeviceMetaConfig = {
  encryptedToken: string | null
  rawToken: string | null
  version: string
  metaAppId: string | null
  metaAppName: string | null
  tokenSource: "DEVICE_OVERRIDE" | "INHERITED_META_APP" | "NONE"
}

export function resolveEffectiveDeviceMetaConfig(
  device: DeviceWithMetaApp
): EffectiveDeviceMetaConfig {
  const version =
    device.whatsappVersion?.trim() ||
    device.whatsappMetaApp?.defaultVersion?.trim() ||
    "v24.0"

  const metaAppId = device.whatsappMetaApp?.metaAppId ?? null
  const metaAppName = device.whatsappMetaApp?.name ?? null

  // 1. Device override via tokenEncrypted
  if (device.tokenEncrypted?.trim()) {
    const parts = device.tokenEncrypted.split(".")
    const encryptedToken =
      device.tokenIv && parts.length === 2
        ? `${parts[0]}.${device.tokenIv}.${parts[1]}`
        : device.tokenEncrypted

    return {
      encryptedToken,
      rawToken: null,
      version,
      metaAppId,
      metaAppName,
      tokenSource: "DEVICE_OVERRIDE",
    }
  }

  // 2. Device override via legacy raw token
  if (device.token?.trim()) {
    return {
      encryptedToken: null,
      rawToken: device.token.trim(),
      version,
      metaAppId,
      metaAppName,
      tokenSource: "DEVICE_OVERRIDE",
    }
  }

  // 3. Fallback / inheritance from linked MetaApp
  if (device.whatsappMetaApp?.systemTokenEncrypted?.trim()) {
    return {
      encryptedToken: device.whatsappMetaApp.systemTokenEncrypted.trim(),
      rawToken: null,
      version,
      metaAppId,
      metaAppName,
      tokenSource: "INHERITED_META_APP",
    }
  }

  return {
    encryptedToken: null,
    rawToken: null,
    version,
    metaAppId,
    metaAppName,
    tokenSource: "NONE",
  }
}

export async function resolveDecryptedDeviceMetaToken(
  device: DeviceWithMetaApp
): Promise<{
  token: string
  version: string
  metaAppId: string | null
  metaAppName: string | null
  tokenSource: "DEVICE_OVERRIDE" | "INHERITED_META_APP"
}> {
  const config = resolveEffectiveDeviceMetaConfig(device)

  if (config.tokenSource === "NONE") {
    throw new DeviceTokenRequiredError()
  }

  let token = ""
  if (config.encryptedToken) {
    token = await decryptWhatsAppToken(config.encryptedToken)
  } else if (config.rawToken) {
    token = config.rawToken
  }

  if (!token) {
    throw new DeviceTokenRequiredError()
  }

  return {
    token,
    version: config.version,
    metaAppId: config.metaAppId,
    metaAppName: config.metaAppName,
    tokenSource: config.tokenSource,
  }
}
