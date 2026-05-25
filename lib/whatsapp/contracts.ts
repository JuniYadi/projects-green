export type VerifyWebhookInput = {
  mode: string
  token: string
  challenge: string
}

export type VerifyWebhookResult = {
  ok: boolean
  challenge?: string
}
