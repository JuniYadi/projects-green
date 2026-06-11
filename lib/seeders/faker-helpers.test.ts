import { describe, it, expect } from "bun:test"
import {
  faker,
  fakerId,
  fakerRecentDate,
  fakerAmount,
  fakerDateRange,
  fakerBillingAccount,
  fakerBillingSubscription,
  fakerInvoiceNumber,
  fakerInvoice,
  fakerInvoiceLine,
  fakerTicketNumber,
  fakerSupportTicket,
  fakerSupportTicketReply,
  fakerVpnClient,
  fakerPhoneNumber,
  fakerWhatsappDevice,
  fakerWhatsappContactGroup,
  fakerWhatsappContact,
  fakerWhatsappMessage,
  fakerKnowledgeDocument,
  fakerArray,
  fakerPick,
  fakerSlug,
} from "./faker-helpers"

// ── Re-exported faker ─────────────────────────────────────────────────────

describe("faker re-export", () => {
  it("exports a faker instance with expected namespaces", () => {
    expect(faker).toBeDefined()
    expect(faker.string).toBeDefined()
    expect(faker.date).toBeDefined()
    expect(faker.person).toBeDefined()
    expect(faker.commerce).toBeDefined()
    expect(faker.lorem).toBeDefined()
  })
})

// ── Common Fields ─────────────────────────────────────────────────────────

describe("fakerId()", () => {
  it("returns a string", () => {
    expect(typeof fakerId()).toBe("string")
  })

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => fakerId()))
    expect(ids.size).toBe(50)
  })
})

describe("fakerRecentDate()", () => {
  it("returns a Date instance", () => {
    const date = fakerRecentDate()
    expect(date).toBeInstanceOf(Date)
  })

  it("returns a date in the past", () => {
    const date = fakerRecentDate()
    expect(date.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("respects daysBack parameter", () => {
    const date = fakerRecentDate(1)
    const oneDayAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(date.getTime()).toBeGreaterThanOrEqual(oneDayAgo.getTime())
  })
})

describe("fakerAmount()", () => {
  it("returns a numeric string", () => {
    const amount = fakerAmount()
    expect(Number(amount)).not.toBeNaN()
    expect(Number(amount)).toBeGreaterThan(0)
  })

  it("returns a string with 2 decimal places", () => {
    const amount = fakerAmount()
    const parts = amount.split(".")
    if (parts.length === 2) {
      expect(parts[1].length).toBeLessThanOrEqual(2)
    }
  })

  it("respects min/max parameters", () => {
    for (let i = 0; i < 20; i++) {
      const amount = Number(fakerAmount(5, 10))
      expect(amount).toBeGreaterThanOrEqual(5)
      expect(amount).toBeLessThanOrEqual(10)
    }
  })
})

describe("fakerDateRange()", () => {
  it("returns an object with start and end dates", () => {
    const range = fakerDateRange()
    expect(range.start).toBeInstanceOf(Date)
    expect(range.end).toBeInstanceOf(Date)
  })

  it("start is always before or equal to end", () => {
    for (let i = 0; i < 20; i++) {
      const range = fakerDateRange()
      expect(range.start.getTime()).toBeLessThanOrEqual(range.end.getTime())
    }
  })
})

// ── Billing Helpers ──────────────────────────────────────────────────────

describe("fakerBillingAccount()", () => {
  it("returns an object matching BillingAccountCreateInput shape", () => {
    const account = fakerBillingAccount({ organizationId: "org-123" })

    expect(typeof account.id).toBe("string")
    expect(account.organizationId).toBe("org-123")
    expect(typeof account.status).toBe("string")
    expect(typeof account.currency).toBe("string")
    expect(account.createdAt).toBeInstanceOf(Date)
    expect(account.updatedAt).toBeInstanceOf(Date)
  })

  it("accepts overrides", () => {
    const account = fakerBillingAccount({
      organizationId: "org-123",
      currency: "IDR",
      status: "ACTIVE",
    })

    expect(account.currency).toBe("IDR")
    expect(account.status).toBe("ACTIVE")
  })
})

describe("fakerBillingSubscription()", () => {
  it("returns an object matching BillingSubscriptionCreateInput shape", () => {
    const sub = fakerBillingSubscription({})

    expect(typeof sub.id).toBe("string")
    expect(sub.billingAccount).toBeDefined()
    expect(sub.billingAccount).toHaveProperty("connect")
    expect(typeof sub.status).toBe("string")
    expect(sub.startedAt).toBeInstanceOf(Date)
    expect(sub.createdAt).toBeInstanceOf(Date)
    expect(sub.updatedAt).toBeInstanceOf(Date)
  })
})

// ── Invoice Helpers ──────────────────────────────────────────────────────

describe("fakerInvoiceNumber()", () => {
  it("returns a string in INV-YYYY-NNNNN format", () => {
    const num = fakerInvoiceNumber()
    const year = new Date().getFullYear()
    expect(num).toMatch(new RegExp(`^INV-${year}-\\d{5}$`))
  })

  it("generates unique invoice numbers", () => {
    const nums = new Set(Array.from({ length: 50 }, () => fakerInvoiceNumber()))
    // Very high probability of uniqueness with 5 random digits
    expect(nums.size).toBeGreaterThan(40)
  })
})

describe("fakerInvoice()", () => {
  it("returns an object matching InvoiceCreateInput shape", () => {
    const invoice = fakerInvoice({})

    expect(typeof invoice.id).toBe("string")
    expect(typeof invoice.invoiceNumber).toBe("string")
    expect(invoice.billingAccount).toHaveProperty("connect")
    expect(typeof invoice.status).toBe("string")
    expect(typeof invoice.currency).toBe("string")
    expect(typeof invoice.subtotalAmount).toBe("string")
    expect(typeof invoice.taxAmount).toBe("string")
    expect(typeof invoice.discountAmount).toBe("string")
    expect(typeof invoice.totalAmount).toBe("string")
    expect(invoice.periodStart).toBeInstanceOf(Date)
    expect(invoice.periodEnd).toBeInstanceOf(Date)
    expect(invoice.dueAt).toBeInstanceOf(Date)
    expect(invoice.createdAt).toBeInstanceOf(Date)
    expect(invoice.updatedAt).toBeInstanceOf(Date)
  })

  it("accepts overrides", () => {
    const invoice = fakerInvoice({
      status: "PAID",
      currency: "EUR",
      totalAmount: "100.00",
    })

    expect(invoice.status).toBe("PAID")
    expect(invoice.currency).toBe("EUR")
    expect(invoice.totalAmount).toBe("100.00")
  })
})

describe("fakerInvoiceLine()", () => {
  it("returns an object matching InvoiceLineCreateInput shape", () => {
    const line = fakerInvoiceLine({})

    expect(typeof line.id).toBe("string")
    expect(line.invoice).toHaveProperty("connect")
    expect(typeof line.lineType).toBe("string")
    expect(typeof line.description).toBe("string")
    expect(typeof line.quantity).toBe("number")
    expect(typeof line.unitPrice).toBe("string")
    expect(typeof line.amount).toBe("string")
    expect(typeof line.currency).toBe("string")
    expect(line.createdAt).toBeInstanceOf(Date)
    expect(line.updatedAt).toBeInstanceOf(Date)
  })
})

// ── Support Ticket Helpers ───────────────────────────────────────────────

describe("fakerTicketNumber()", () => {
  it("returns a string in TKT-NNNNNN format", () => {
    const num = fakerTicketNumber()
    expect(num).toMatch(/^TKT-\d{6}$/)
  })
})

describe("fakerSupportTicket()", () => {
  it("returns an object matching SupportTicketCreateInput shape", () => {
    const ticket = fakerSupportTicket({
      organizationId: "org-123",
      requesterWorkosUserId: "user-abc",
    })

    expect(typeof ticket.id).toBe("string")
    expect(typeof ticket.ticketNumber).toBe("string")
    expect(ticket.organizationId).toBe("org-123")
    expect(ticket.requesterWorkosUserId).toBe("user-abc")
    expect(typeof ticket.department).toBe("string")
    expect(typeof ticket.priority).toBe("string")
    expect(typeof ticket.service).toBe("string")
    expect(typeof ticket.status).toBe("string")
    expect(typeof ticket.subject).toBe("string")
    expect(typeof ticket.description).toBe("string")
    expect(ticket.createdAt).toBeInstanceOf(Date)
    expect(ticket.updatedAt).toBeInstanceOf(Date)
  })

  it("accepts overrides", () => {
    const ticket = fakerSupportTicket({
      organizationId: "org-123",
      requesterWorkosUserId: "user-abc",
      status: "CLOSED",
      subject: "Help me",
    })

    expect(ticket.status).toBe("CLOSED")
    expect(ticket.subject).toBe("Help me")
  })
})

describe("fakerSupportTicketReply()", () => {
  it("returns an object matching SupportTicketReplyCreateInput shape", () => {
    const reply = fakerSupportTicketReply({
      authorWorkosUserId: "user-abc",
    })

    expect(typeof reply.id).toBe("string")
    expect(reply.ticket).toHaveProperty("connect")
    expect(reply.authorWorkosUserId).toBe("user-abc")
    expect(typeof reply.body).toBe("string")
    expect(reply.createdAt).toBeInstanceOf(Date)
    expect(reply.updatedAt).toBeInstanceOf(Date)
  })
})

// ── VPN Helpers ──────────────────────────────────────────────────────────

describe("fakerVpnClient()", () => {
  it("returns an object matching VpnClientCreateInput shape", () => {
    const client = fakerVpnClient({ organizationId: "org-123" })

    expect(typeof client.id).toBe("string")
    expect(client.organizationId).toBe("org-123")
    expect(client.subscription).toHaveProperty("connect")
    expect(typeof client.provider).toBe("string")
    expect(typeof client.regionCode).toBe("string")
    expect(typeof client.clientName).toBe("string")
    expect(typeof client.status).toBe("string")
    expect(client.currentPeriodStart).toBeInstanceOf(Date)
    expect(client.currentPeriodEnd).toBeInstanceOf(Date)
    expect(client.createdAt).toBeInstanceOf(Date)
    expect(client.updatedAt).toBeInstanceOf(Date)
  })

  it("starts currentPeriodStart before currentPeriodEnd", () => {
    for (let i = 0; i < 20; i++) {
      const client = fakerVpnClient({ organizationId: "org-123" })
      const start =
        client.currentPeriodStart instanceof Date
          ? client.currentPeriodStart
          : new Date(client.currentPeriodStart as string)
      const end =
        client.currentPeriodEnd instanceof Date
          ? client.currentPeriodEnd
          : new Date(client.currentPeriodEnd as string)
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
    }
  })
})

// ── WhatsApp Helpers ─────────────────────────────────────────────────────

describe("fakerPhoneNumber()", () => {
  it("returns a string", () => {
    expect(typeof fakerPhoneNumber()).toBe("string")
  })

  it("returns a non-empty string", () => {
    expect(fakerPhoneNumber().length).toBeGreaterThan(0)
  })
})

describe("fakerWhatsappDevice()", () => {
  it("returns an object matching WhatsappDeviceCreateInput shape", () => {
    const device = fakerWhatsappDevice({
      organizationId: "org-123",
      phoneNumber: "+62812345678",
    })

    expect(typeof device.id).toBe("string")
    expect(device.organizationId).toBe("org-123")
    expect(device.phoneNumber).toBe("+62812345678")
    expect(typeof device.status).toBe("string")
    expect(device.createdAt).toBeInstanceOf(Date)
    expect(device.updatedAt).toBeInstanceOf(Date)
  })
})

describe("fakerWhatsappContactGroup()", () => {
  it("returns an object matching WhatsappContactGroupCreateInput shape", () => {
    const group = fakerWhatsappContactGroup({ organizationId: "org-123" })

    expect(typeof group.id).toBe("string")
    expect(group.organizationId).toBe("org-123")
    expect(typeof group.name).toBe("string")
    expect(typeof group.description).toBe("string")
    expect(typeof group.type).toBe("string")
    expect(typeof group.status).toBe("string")
    expect(group.createdAt).toBeInstanceOf(Date)
    expect(group.updatedAt).toBeInstanceOf(Date)
  })
})

describe("fakerWhatsappContact()", () => {
  it("returns an object matching WhatsappContactCreateInput shape", () => {
    const contact = fakerWhatsappContact({
      organizationId: "org-123",
      phoneNumber: "+62898765432",
    })

    expect(typeof contact.id).toBe("string")
    expect(contact.organizationId).toBe("org-123")
    expect(contact.phoneNumber).toBe("+62898765432")
    expect(typeof contact.name).toBe("string")
    expect(typeof contact.email).toBe("string")
    expect(typeof contact.status).toBe("string")
    expect(contact.contactGroup).toHaveProperty("connect")
    expect(contact.createdAt).toBeInstanceOf(Date)
    expect(contact.updatedAt).toBeInstanceOf(Date)
  })
})

describe("fakerWhatsappMessage()", () => {
  it("returns an object matching WhatsappMessageCreateInput shape", () => {
    const msg = fakerWhatsappMessage({})

    expect(typeof msg.id).toBe("string")
    expect(msg.conversation).toHaveProperty("connect")
    expect(typeof msg.direction).toBe("string")
    expect(typeof msg.messageType).toBe("string")
    expect(typeof msg.body).toBe("string")
    expect(msg.createdAt).toBeInstanceOf(Date)
    expect(msg.updatedAt).toBeInstanceOf(Date)
  })
})

// ── Knowledge Document Helpers ───────────────────────────────────────────

describe("fakerKnowledgeDocument()", () => {
  it("returns an object matching DocsKnowledgeDocumentCreateInput shape", () => {
    const doc = fakerKnowledgeDocument({
      updatedByWorkosUserId: "user-abc",
    })

    expect(typeof doc.id).toBe("string")
    expect(typeof doc.path).toBe("string")
    expect(typeof doc.title).toBe("string")
    expect(typeof doc.purpose).toBe("string")
    expect(Array.isArray(doc.howTo)).toBe(true)
    expect(Array.isArray(doc.notes)).toBe(true)
    expect(typeof doc.searchText).toBe("string")
    expect(Array.isArray(doc.embedding)).toBe(true)
    expect(doc.updatedByWorkosUserId).toBe("user-abc")
    expect(doc.createdAt).toBeInstanceOf(Date)
    expect(doc.updatedAt).toBeInstanceOf(Date)
  })

  it("accepts overrides", () => {
    const doc = fakerKnowledgeDocument({
      updatedByWorkosUserId: "user-abc",
      title: "Custom Title",
      organizationId: "org-123",
    })

    expect(doc.title).toBe("Custom Title")
    expect(doc.organizationId).toBe("org-123")
  })
})

// ── Array Helpers ────────────────────────────────────────────────────────

describe("fakerArray()", () => {
  it("generates an array of the specified length", () => {
    const items = fakerArray(5, (i) => ({ index: i }))
    expect(items).toHaveLength(5)
  })

  it("passes the index to the factory function", () => {
    const items = fakerArray(3, (i) => i)
    expect(items).toEqual([0, 1, 2])
  })

  it("returns empty array for count 0", () => {
    const items = fakerArray(0, () => "x")
    expect(items).toEqual([])
  })

  it("works with faker helpers inside factory", () => {
    const ids = fakerArray(10, () => fakerId())
    expect(ids).toHaveLength(10)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(10)
  })
})

describe("fakerPick()", () => {
  it("picks the specified number of items", () => {
    const items = ["a", "b", "c", "d", "e"]
    const picked = fakerPick(items, 3)
    expect(picked).toHaveLength(3)
  })

  it("picks items from the source array", () => {
    const items = ["a", "b", "c"]
    const picked = fakerPick(items, 2)
    for (const item of picked) {
      expect(items).toContain(item)
    }
  })

  it("defaults to picking 1 item", () => {
    const items = ["a", "b", "c"]
    const picked = fakerPick(items)
    expect(picked).toHaveLength(1)
  })
})

describe("fakerSlug()", () => {
  it("returns a lowercase string", () => {
    const slug = fakerSlug()
    expect(slug).toBe(slug.toLowerCase())
  })

  it("returns a non-empty string", () => {
    expect(fakerSlug().length).toBeGreaterThan(0)
  })

  it("does not contain spaces", () => {
    const slug = fakerSlug()
    expect(slug).not.toContain(" ")
  })
})
