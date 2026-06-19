import { describe, it, expect } from "bun:test"
import { SecretBuilder, TLS_SECRET_TYPE } from "./secret.builder"

describe("SecretBuilder", () => {
  it("generates Secret with base64-encoded data", () => {
    const secret = new SecretBuilder()
      .setName("my-secret")
      .setNamespace("default")
      .addData({ DATABASE_PASSWORD: "supersecret" })
      .build()

    expect(secret.apiVersion).toBe("v1")
    expect(secret.kind).toBe("Secret")
    expect(secret.metadata.name).toBe("my-secret")
    expect(secret.type).toBe("Opaque")
    // Base64 encoded
    expect(secret.data!.DATABASE_PASSWORD).toBe(
      Buffer.from("supersecret").toString("base64")
    )
  })

  it("generates TLS Secret", () => {
    const secret = new SecretBuilder()
      .setName("my-tls-secret")
      .setNamespace("default")
      .setType(TLS_SECRET_TYPE)
      .addTLSData({
        cert: "-----BEGIN CERTIFICATE-----\ncert-content\n-----END CERTIFICATE-----",
        key: "-----BEGIN PRIVATE KEY-----\nkey-content\n-----END PRIVATE KEY-----",
      })
      .build()

    expect(secret.type).toBe("kubernetes.io/tls")
    expect(secret.data!["tls.crt"]).toBe(
      Buffer.from(
        "-----BEGIN CERTIFICATE-----\ncert-content\n-----END CERTIFICATE-----"
      ).toString("base64")
    )
    expect(secret.data!["tls.key"]).toBe(
      Buffer.from(
        "-----BEGIN PRIVATE KEY-----\nkey-content\n-----END PRIVATE KEY-----"
      ).toString("base64")
    )
  })

  it("adds reloader annotation for auto-restart", () => {
    const secret = new SecretBuilder()
      .setName("my-secret")
      .addReloaderAnnotation()
      .build()

    expect(secret.metadata.annotations!["reloader.stakater.com/auto"]).toBe(
      "true"
    )
  })

  it("generates Secret with stringData", () => {
    const secret = new SecretBuilder()
      .setName("my-secret")
      .setNamespace("default")
      .addStringData({ CONFIG_VALUE: "plaintext-value" })
      .build()

    expect(secret.stringData).toEqual({ CONFIG_VALUE: "plaintext-value" })
    expect(secret.data).toBeUndefined()
  })
})
