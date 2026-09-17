import { describe, expect, it } from "bun:test"
import { encryptEnvelope } from "@/lib/vault/vault-envelope"
import { createClientSessionCrypto } from "./client-crypto"

describe("Client-Side Envelope Encryption & Decryption", () => {
  it("encrypts secret on server and decrypts cleanly on client without plaintext wire transit", async () => {
    // 1. Client creates ephemeral session key
    const client = await createClientSessionCrypto()
    expect(client.publicKeyJwk.kty).toBe("EC")
    expect(client.publicKeyJwk.crv).toBe("P-256")

    // 2. Server encrypts secret using client public key
    const secretValue = "super-secret-password-12345!"
    const envelope = await encryptEnvelope(secretValue, client.publicKeyJwk)

    expect(envelope.encrypted).toBe(true)
    expect(envelope.ciphertext).not.toBe(secretValue)
    expect(envelope.serverPublicKey.kty).toBe("EC")

    // 3. Client decrypts ciphertext
    const decrypted = await client.decrypt(envelope)
    expect(decrypted).toBe(secretValue)
  })
})
