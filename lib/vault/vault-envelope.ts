export type ClientPublicKeyJwk = JsonWebKey

export type EnvelopeEncryptedPayload = {
  encrypted: true
  serverPublicKey: JsonWebKey
  iv: string // base64
  ciphertext: string // base64
}

/**
 * Server-side envelope encryption using Web Crypto API.
 * Derives a shared secret with the client's ephemeral ECDH P-256 public key,
 * then encrypts the plaintext using AES-256-GCM.
 */
export async function encryptEnvelope(
  plaintext: string,
  clientPublicKeyJwk: ClientPublicKeyJwk
): Promise<EnvelopeEncryptedPayload> {
  const subtle = crypto.subtle

  const clientKey = await subtle.importKey(
    "jwk",
    clientPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  )

  const serverKeypair = (await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair

  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    serverKeypair.privateKey,
    256
  )

  const aesKey = await subtle.importKey(
    "raw",
    sharedBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encodedPlaintext = new TextEncoder().encode(plaintext)

  const ciphertextBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedPlaintext
  )

  const serverPublicKey = await subtle.exportKey("jwk", serverKeypair.publicKey)

  return {
    encrypted: true,
    serverPublicKey,
    iv: Buffer.from(iv).toString("base64"),
    ciphertext: Buffer.from(ciphertextBuffer).toString("base64"),
  }
}
