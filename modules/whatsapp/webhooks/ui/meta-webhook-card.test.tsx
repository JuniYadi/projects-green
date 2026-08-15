import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import React from "react"

import { MetaWebhookCard } from "./meta-webhook-card"

describe("MetaWebhookCard", () => {
  const originalAppUrl = process.env.APP_URL

  beforeEach(() => {
    process.env.APP_URL = "https://portal.example.com/"
  })

  afterEach(() => {
    cleanup()
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
  })

  it("renders the attached Meta App and its resolved callback URL", () => {
    const { getByText } = render(
      <MetaWebhookCard
        metaApp={{
          name: "Acme WhatsApp",
          callbackPath: "/api/whatsapp/meta-webhook/acme-key",
        }}
      />
    )

    expect(getByText("Acme WhatsApp")).toBeDefined()
    expect(
      getByText("https://portal.example.com/api/whatsapp/meta-webhook/acme-key")
    ).toBeDefined()
  })

  it("explains when the device has no attached Meta App", () => {
    const { getByText } = render(<MetaWebhookCard metaApp={null} />)

    expect(
      getByText(
        "No Meta App is attached to this device. Inbound Meta webhooks are not configured."
      )
    ).toBeDefined()
  })
})
