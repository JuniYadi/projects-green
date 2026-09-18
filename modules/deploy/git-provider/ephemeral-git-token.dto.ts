export type EphemeralGitCredentialPayload = {
  provider: "github"
  username: "x-access-token"
  token: string
  cloneUrl: string
  expiresAt: number
}

export type EphemeralGitTokenResponseDto = {
  ok: true
  encrypted: true
  serverPublicKey: JsonWebKey
  iv: string
  ciphertext: string
  expiresAt: number
}
