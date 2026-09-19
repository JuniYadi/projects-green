import { describe, expect, it } from "bun:test"
import {
  ENVELOPE_HKDF_INFO,
  ENVELOPE_HKDF_SALT,
  encryptEnvelope,
} from "./vault-envelope"

describe("vault-envelope", () => {
  it("encrypts plaintext using client ECDH P-256 public key", async () => {
    const subtle = crypto.subtle

    // Client generates ephemeral keypair
    const clientKeypair = (await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    )) as CryptoKeyPair

    const clientPublicKeyJwk = (await subtle.exportKey(
      "jwk",
      clientKeypair.publicKey
    )) as JsonWebKey

    const secretText = "my-secure-database-password-2026!"
    const envelope = await encryptEnvelope(secretText, clientPublicKeyJwk)

    expect(envelope.encrypted).toBe(true)
    expect(typeof envelope.iv).toBe("string")
    expect(typeof envelope.ciphertext).toBe("string")
    expect(envelope.serverPublicKey.kty).toBe("EC")
    expect(envelope.serverPublicKey.crv).toBe("P-256")

    // Verify client can decrypt the derived payload
    const serverKey = await subtle.importKey(
      "jwk",
      envelope.serverPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    )

    const sharedBits = await subtle.deriveBits(
      { name: "ECDH", public: serverKey },
      clientKeypair.privateKey,
      256
    )

    const hkdfKey = await subtle.importKey(
      "raw",
      sharedBits,
      { name: "HKDF" },
      false,
      ["deriveKey"]
    )

    const aesKey = await subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: ENVELOPE_HKDF_SALT,
        info: ENVELOPE_HKDF_INFO,
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    )

    const iv = Uint8Array.from(atob(envelope.iv), (c) => c.charCodeAt(0))
    const ciphertext = Uint8Array.from(atob(envelope.ciphertext), (c) =>
      c.charCodeAt(0)
    )

    const decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    )

    expect(new TextDecoder().decode(decrypted)).toBe(secretText)
  })
})
