import type {
  ClientPublicKeyJwk,
  EnvelopeEncryptedPayload,
} from "@/lib/vault/vault-envelope"

export type ClientSessionCrypto = {
  publicKeyJwk: ClientPublicKeyJwk
  decrypt: (payload: EnvelopeEncryptedPayload) => Promise<string>
}

/**
 * Creates an ephemeral ECDH keypair in browser memory.
 * Returns the public key (to be sent to the server) and a decrypt method
 * that decrypts the returned envelope ciphertext strictly in browser RAM.
 */
export async function createClientSessionCrypto(): Promise<ClientSessionCrypto> {
  const subtle =
    typeof window !== "undefined" && window.crypto?.subtle
      ? window.crypto.subtle
      : crypto.subtle

  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment.")
  }

  const keypair = (await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair

  const publicKeyJwk = (await subtle.exportKey(
    "jwk",
    keypair.publicKey
  )) as ClientPublicKeyJwk

  const decrypt = async (
    payload: EnvelopeEncryptedPayload
  ): Promise<string> => {
    const serverKey = await subtle.importKey(
      "jwk",
      payload.serverPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    )

    const sharedBits = await subtle.deriveBits(
      { name: "ECDH", public: serverKey },
      keypair.privateKey,
      256
    )

    const aesKey = await subtle.importKey(
      "raw",
      sharedBits,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    )

    const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0))
    const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) =>
      c.charCodeAt(0)
    )

    const decryptedBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    )

    return new TextDecoder().decode(decryptedBuffer)
  }

  return { publicKeyJwk, decrypt }
}
