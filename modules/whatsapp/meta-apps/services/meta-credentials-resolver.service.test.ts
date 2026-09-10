import { describe, expect, it, mock } from "bun:test"
import {
  resolveEffectiveDeviceMetaConfig,
  resolveDecryptedDeviceMetaToken,
  DeviceTokenRequiredError,
} from "./meta-credentials-resolver.service"

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: async (ciphertext: string) => `decrypted:${ciphertext}`,
}))

describe("resolveEffectiveDeviceMetaConfig", () => {
  it("uses device token and version as override when present", () => {
    const config = resolveEffectiveDeviceMetaConfig({
      tokenEncrypted: "device-token-enc",
      whatsappVersion: "v22.0",
      whatsappMetaApp: {
        metaAppId: "meta-app-1",
        name: "PFNAppID",
        systemTokenEncrypted: "system-token-enc",
        defaultVersion: "v24.0",
      },
    })

    expect(config.encryptedToken).toBe("device-token-enc")
    expect(config.version).toBe("v22.0")
    expect(config.tokenSource).toBe("DEVICE_OVERRIDE")
    expect(config.metaAppId).toBe("meta-app-1")
    expect(config.metaAppName).toBe("PFNAppID")
  })

  it("inherits system token and default version from MetaApp when device has null values", () => {
    const config = resolveEffectiveDeviceMetaConfig({
      tokenEncrypted: null,
      whatsappVersion: null,
      whatsappMetaApp: {
        metaAppId: "meta-app-1",
        name: "PFNAppID",
        systemTokenEncrypted: "system-token-enc",
        defaultVersion: "v25.0",
      },
    })

    expect(config.encryptedToken).toBe("system-token-enc")
    expect(config.version).toBe("v25.0")
    expect(config.tokenSource).toBe("INHERITED_META_APP")
    expect(config.metaAppId).toBe("meta-app-1")
  })

  it("defaults version to v24.0 when neither device nor MetaApp specifies version", () => {
    const config = resolveEffectiveDeviceMetaConfig({
      tokenEncrypted: null,
      whatsappVersion: null,
      whatsappMetaApp: null,
    })

    expect(config.version).toBe("v24.0")
    expect(config.tokenSource).toBe("NONE")
  })
})

describe("resolveDecryptedDeviceMetaToken", () => {
  it("decrypts inherited system token when device token is empty", async () => {
    const result = await resolveDecryptedDeviceMetaToken({
      tokenEncrypted: null,
      whatsappMetaApp: {
        metaAppId: "meta-app-1",
        name: "PFNAppID",
        systemTokenEncrypted: "sys-token-enc",
        defaultVersion: "v24.0",
      },
    })

    expect(result.token).toBe("decrypted:sys-token-enc")
    expect(result.tokenSource).toBe("INHERITED_META_APP")
  })

  it("throws DeviceTokenRequiredError when neither device nor MetaApp provides a token", async () => {
    await expect(
      resolveDecryptedDeviceMetaToken({
        tokenEncrypted: null,
        whatsappMetaApp: null,
      })
    ).rejects.toThrow(DeviceTokenRequiredError)
  })
})
