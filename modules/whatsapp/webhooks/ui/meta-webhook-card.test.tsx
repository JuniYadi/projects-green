import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { MetaWebhookCard } from "./meta-webhook-card"

describe("MetaWebhookCard", () => {
  it("renders the attached Meta App and its resolved callback URL", () => {
    const view = render(
      <MetaWebhookCard
        metaWebhook={{
          appName: "Primary Meta App",
          callbackUrl:
            "https://portal.example.com/api/whatsapp/meta-webhook/webhook-key",
        }}
      />
    )

    expect(view.getByText("Primary Meta App")).toBeTruthy()
    expect(
      view.getByText(
        "https://portal.example.com/api/whatsapp/meta-webhook/webhook-key"
      )
    ).toBeTruthy()
  })

  it("renders an empty state when no Meta App is attached", () => {
    const view = render(<MetaWebhookCard metaWebhook={null} />)

    expect(
      view.getByText(
        "No Meta App is attached to this device. Inbound Meta webhooks are not configured."
      )
    ).toBeTruthy()
    expect(view.queryByText(/meta-webhook/)).toBeNull()
  })
})
