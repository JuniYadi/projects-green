import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TicketClosedEmail } from "./emails/ticket-closed"
import { TicketCreatedEmail } from "./emails/ticket-created"
import { TicketNewAdminAlertEmail } from "./emails/ticket-new-admin-alert"
import { TicketRepliedEmail } from "./emails/ticket-replied"

const baseTicket = {
  id: "ticket_1",
  ticketNumber: "TCK-1001",
  organizationId: "org_1",
  requesterWorkosUserId: "user_1",
  assignedAgentWorkosUserId: null,
  department: "technical" as const,
  priority: "medium" as const,
  service: "deploy" as const,
  status: "open" as const,
  subject: "Deployment issue",
  description: "Pipeline failed",
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date("2026-05-21T00:00:00.000Z"),
  updatedAt: new Date("2026-05-21T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
}

const baseReply = {
  id: "reply_1",
  ticketId: "ticket_1",
  authorWorkosUserId: "user_admin",
  body: "Looking into this now",
  secureForm: null,
  isInternalNote: false,
  attachmentMetadata: [],
  createdAt: new Date("2026-05-21T01:00:00.000Z"),
  updatedAt: new Date("2026-05-21T01:00:00.000Z"),
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el)

describe("ticket email links use APP_URL", () => {
  const originalAppUrl = process.env.APP_URL
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    }
  })

  it("requester email ticket link uses APP_URL", () => {
    process.env.APP_URL = "https://app.example.com"
    const html = render(<TicketCreatedEmail ticket={baseTicket} />)
    expect(html).toContain(
      "https://app.example.com/console/support-tickets/ticket_1"
    )
    expect(html).not.toContain("localhost")
  })

  it("admin alert ticket link uses APP_URL", () => {
    process.env.APP_URL = "https://app.example.com"
    const html = render(<TicketNewAdminAlertEmail ticket={baseTicket} />)
    expect(html).toContain(
      "https://app.example.com/portal/support-tickets/ticket_1"
    )
    expect(html).not.toContain("localhost")
  })

  it("replied email ticket link uses APP_URL", () => {
    process.env.APP_URL = "https://app.example.com"
    const html = render(
      <TicketRepliedEmail ticket={baseTicket} reply={baseReply} />
    )
    expect(html).toContain(
      "https://app.example.com/console/support-tickets/ticket_1"
    )
    expect(html).not.toContain("localhost")
  })

  it("closed email ticket link uses APP_URL", () => {
    process.env.APP_URL = "https://app.example.com"
    const html = render(
      <TicketClosedEmail ticket={{ ...baseTicket, status: "closed" }} />
    )
    expect(html).toContain(
      "https://app.example.com/console/support-tickets/ticket_1"
    )
    expect(html).not.toContain("localhost")
  })

  it("falls back to localhost when APP_URL is unset", () => {
    const html = render(<TicketCreatedEmail ticket={baseTicket} />)
    expect(html).toContain(
      "http://localhost:3300/console/support-tickets/ticket_1"
    )
  })
})
