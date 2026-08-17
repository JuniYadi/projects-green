export class WhatsappSendFailedError extends Error {
  readonly messageId: string

  constructor(message: string, messageId: string) {
    super(message)
    this.name = "WhatsappSendFailedError"
    this.messageId = messageId
  }
}

export function getWhatsappSendErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
