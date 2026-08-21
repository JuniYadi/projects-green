import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToString } from "react-dom/server"
import { MessageStatusBadge } from "./message-status-badge"

describe("MessageStatusBadge", () => {
  it("renders null for INBOX messages", () => {
    const html = renderToString(
      <MessageStatusBadge
        direction="INBOX"
        statusHistory={[{ status: "SENT", error: null }]}
      />
    )
    expect(html).toBe("")
  })

  it("renders null when status history is empty", () => {
    const html = renderToString(
      <MessageStatusBadge direction="OUTBOX" statusHistory={[]} />
    )
    expect(html).toBe("")
  })

  it("renders Sent for single SENT status", () => {
    const html = renderToString(
      <MessageStatusBadge
        direction="OUTBOX"
        statusHistory={[{ status: "SENT", error: null }]}
      />
    )
    expect(html).toContain("Sent")
  })

  it("renders Delivered over Sent when both exist", () => {
    const html = renderToString(
      <MessageStatusBadge
        direction="OUTBOX"
        statusHistory={[
          { status: "SENT", error: null },
          { status: "DELIVERED", error: null },
        ]}
      />
    )
    expect(html).toContain("Delivered")
    expect(html).not.toContain("Sent")
  })

  it("renders Read over Delivered when both exist", () => {
    const html = renderToString(
      <MessageStatusBadge
        direction="OUTBOX"
        statusHistory={[
          { status: "SENT", error: null },
          { status: "DELIVERED", error: null },
          { status: "READ", error: null },
        ]}
      />
    )
    expect(html).toContain("Read")
    expect(html).not.toContain("Delivered")
  })

  it("prioritizes FAILED over SENT and displays failure status", () => {
    const html = renderToString(
      <MessageStatusBadge
        direction="OUTBOX"
        statusHistory={[
          { status: "SENT", error: null },
          { status: "FAILED", error: "Recipient phone number not registered" },
        ]}
      />
    )
    expect(html).toContain("Failed")
    expect(html).not.toContain("Sent")
  })
})
