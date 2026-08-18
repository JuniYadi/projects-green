export class WhatsappSendFailedError extends Error {
  readonly messageId: string

  constructor(message: string, messageId: string) {
    super(message)
    this.name = "WhatsappSendFailedError"
    this.messageId = messageId
  }
}

export class WhatsappSessionWindowClosedError extends Error {
  constructor() {
    super(
      "Template required outside the 24-hour customer service window. " +
        "Use /messages/send-template."
    )
    this.name = "WhatsappSessionWindowClosedError"
  }
}

export function getWhatsappSendErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
