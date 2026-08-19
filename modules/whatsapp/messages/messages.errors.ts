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
export class UnsupportedDestinationCountryError extends Error {
  readonly country: string
  readonly phoneNumber: string

  constructor(country: string, phoneNumber: string) {
    super(
      `Destination country '${country}' for phone number '${phoneNumber}' is not configured in pricing rates.`
    )
    this.name = "UnsupportedDestinationCountryError"
    this.country = country
    this.phoneNumber = phoneNumber
  }
}

export function getWhatsappSendErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
