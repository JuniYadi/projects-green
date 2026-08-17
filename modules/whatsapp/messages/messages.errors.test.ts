import { describe, expect, it } from "bun:test"
import {
  getWhatsappSendErrorMessage,
  WhatsappSendFailedError,
} from "./messages.errors"

describe("WhatsappSendFailedError", () => {
  it("preserves the provider message and created message id", () => {
    const error = new WhatsappSendFailedError(
      "Meta rejected the message",
      "msg-1"
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("WhatsappSendFailedError")
    expect(error.message).toBe("Meta rejected the message")
    expect(error.messageId).toBe("msg-1")
  })

  it("extracts messages from unknown errors", () => {
    expect(getWhatsappSendErrorMessage(new Error("Provider error"))).toBe(
      "Provider error"
    )
    expect(getWhatsappSendErrorMessage("Provider error")).toBe("Provider error")
  })
})
