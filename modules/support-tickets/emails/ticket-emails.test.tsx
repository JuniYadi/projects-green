import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TicketCreatedEmail } from "./ticket-created"
import { TicketNewAdminAlertEmail } from "./ticket-new-admin-alert"
import { TicketRepliedEmail } from "./ticket-replied"
import { TicketClosedEmail } from "./ticket-closed"

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

describe("ticket email templates", () => {
  describe("TicketCreatedEmail", () => {
    it("includes organization metadata when provided", () => {
      const html = render(
        <TicketCreatedEmail
          ticket={baseTicket}
          organization={{
            organizationId: "org_1",
            organizationName: "Acme Corp",
          }}
        />
      )
      expect(html).toContain("Organization:")
      expect(html).toContain("Acme Corp (org_1)")
    })

    it("falls back to Unknown organization when name is null", () => {
      const html = render(
        <TicketCreatedEmail
          ticket={baseTicket}
          organization={{
            organizationId: "org_missing",
            organizationName: null,
          }}
        />
      )
      expect(html).toContain("Unknown organization (org_missing)")
    })

    it("omits organization line when not provided", () => {
      const html = render(<TicketCreatedEmail ticket={baseTicket} />)
      expect(html).not.toContain("Organization:")
    })
  })

  describe("TicketNewAdminAlertEmail", () => {
    it("includes organization metadata and deep link for created variant", () => {
      const html = render(
        <TicketNewAdminAlertEmail
          ticket={baseTicket}
          organization={{
            organizationId: "org_1",
            organizationName: "Acme Corp",
            organizationUrl: "http://localhost:3300/en/portal/orgs/org_1",
          }}
        />
      )
      expect(html).toContain("Acme Corp (org_1)")
      expect(html).toContain("/en/portal/orgs/org_1")
      expect(html).toContain("Open Organization")
    })

    it("omits deep link when organizationUrl is absent", () => {
      const html = render(
        <TicketNewAdminAlertEmail
          ticket={baseTicket}
          organization={{
            organizationId: "org_1",
            organizationName: "Acme Corp",
          }}
        />
      )
      expect(html).toContain("Acme Corp (org_1)")
      expect(html).not.toContain("Open Organization")
    })

    it("renders structured reply section with author and secure note", () => {
      const html = render(
        <TicketNewAdminAlertEmail
          ticket={baseTicket}
          variant="reply"
          reply={{ ...baseReply, secureForm: "encrypted-blob" }}
          replyContext={{
            authorName: "Staff User",
            authorRole: "Support Admin",
            hasSecureDetails: true,
            repliedAt: new Date("2026-05-21T01:00:00.000Z"),
          }}
        />
      )
      expect(html).toContain("Re: Deployment issue")
      expect(html).toContain("Staff User")
      expect(html).toContain("Support Admin")
      expect(html).toContain("Looking into this now")
      expect(html).toContain(
        "Secure details attached (encrypted). Open the ticket to view."
      )
      expect(html).not.toContain("encrypted-blob")
    })

    it("omits secure note when hasSecureDetails is false", () => {
      const html = render(
        <TicketNewAdminAlertEmail
          ticket={baseTicket}
          variant="reply"
          reply={baseReply}
          replyContext={{
            authorName: "Staff User",
            authorRole: "Support Admin",
            hasSecureDetails: false,
            repliedAt: new Date("2026-05-21T01:00:00.000Z"),
          }}
        />
      )
      expect(html).not.toContain("Secure details attached")
    })
  })

  describe("TicketRepliedEmail", () => {
    it("renders structured reply with author, role, and timestamp", () => {
      const html = render(
        <TicketRepliedEmail
          ticket={baseTicket}
          reply={baseReply}
          replyContext={{
            authorName: "Staff User",
            authorRole: "Support Admin",
            hasSecureDetails: false,
            repliedAt: new Date("2026-05-21T01:00:00.000Z"),
          }}
        />
      )
      expect(html).toContain("Re: Deployment issue")
      expect(html).toContain("Staff User")
      expect(html).toContain("Support Admin")
      expect(html).toContain("Looking into this now")
    })

    it("includes secure note when hasSecureDetails is true", () => {
      const html = render(
        <TicketRepliedEmail
          ticket={baseTicket}
          reply={{ ...baseReply, secureForm: "encrypted-blob" }}
          replyContext={{
            authorName: "Staff User",
            authorRole: "Support Admin",
            hasSecureDetails: true,
            repliedAt: new Date("2026-05-21T01:00:00.000Z"),
          }}
        />
      )
      expect(html).toContain(
        "Secure details attached (encrypted). Open the ticket to view."
      )
      expect(html).not.toContain("encrypted-blob")
    })

    it("omits secure note when hasSecureDetails is false", () => {
      const html = render(
        <TicketRepliedEmail
          ticket={baseTicket}
          reply={baseReply}
          replyContext={{
            authorName: "Staff User",
            authorRole: "Requester",
            hasSecureDetails: false,
            repliedAt: new Date("2026-05-21T01:00:00.000Z"),
          }}
        />
      )
      expect(html).not.toContain("Secure details attached")
    })

    it("falls back to generic intro when replyContext is absent", () => {
      const html = render(
        <TicketRepliedEmail ticket={baseTicket} reply={baseReply} />
      )
      expect(html).toContain(
        "A member of our support team has replied to your ticket."
      )
      expect(html).not.toContain("Replied by")
    })
  })
})

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
