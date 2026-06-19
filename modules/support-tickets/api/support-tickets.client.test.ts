import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"

const ticketFixture = {
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

const replyFixture = {
  id: "reply_1",
  ticketId: "ticket_1",
  authorWorkosUserId: "user_1",
  body: "Acknowledged",
  secureForm: null,
  isInternalNote: false,
  attachmentMetadata: [],
  createdAt: new Date("2026-05-21T01:00:00.000Z"),
  updatedAt: new Date("2026-05-21T01:00:00.000Z"),
}

const attachmentFixture = {
  id: "att_1",
  fileName: "error.log",
  mimeType: "text/plain",
  sizeBytes: 12,
  storageKey: "support/att_1",
  checksumSha256: null,
  uploadedAt: "2026-05-21T01:00:00.000Z",
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

const fetchMock = mock<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(async () => jsonResponse({}))

describe("support tickets client", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    ;(globalThis as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    fetchMock.mockReset()
  })

  it("lists tickets and maps server payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, tickets: [ticketFixture] })
    )
    const client = createSupportTicketsClient()

    const tickets = await client.listTickets()

    expect(tickets).toHaveLength(1)
    expect(tickets[0]?.id).toBe("ticket_1")
    expect(fetchMock).toHaveBeenCalledWith("/api/support-tickets", undefined)
  })

  it("throws fallback error when non-json response fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream error", { status: 500 })
    )
    const client = createSupportTicketsClient()

    await expect(client.listTickets()).rejects.toThrow(
      "Unable to load support tickets."
    )
  })

  it("creates ticket, reads thread, and posts replies", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, ticket: ticketFixture }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          thread: { ticket: ticketFixture, replies: [] },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, reply: replyFixture }))
    const client = createSupportTicketsClient()

    const created = await client.createTicket({
      subject: "Deployment issue",
      department: "technical",
      priority: "high",
      service: "deploy",
      description: "Pipeline",
      secureForm: null,
    })
    const thread = await client.getTicketThread("ticket_1")
    const reply = await client.addReply({
      ticketId: "ticket_1",
      body: "Ack",
    })

    expect(created.id).toBe("ticket_1")
    expect(thread.ticket.id).toBe("ticket_1")
    expect(reply.id).toBe("reply_1")
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
    })
  })

  it("closes ticket and preserves API message errors", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, ticket: ticketFixture }))
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: false, message: "Only support staff can close this ticket." },
          403
        )
      )
    const client = createSupportTicketsClient()

    const ticket = await client.closeTicket("ticket_1")
    expect(ticket.id).toBe("ticket_1")

    await expect(client.closeTicket("ticket_1")).rejects.toThrow(
      "Only support staff can close this ticket."
    )
  })

  it("handles attachment presign, upload, and register flow", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          attachment: {
            attachmentId: "att_1",
            expiresAt: "2026-05-21T01:00:00.000Z",
            storageBucket: "bucket-a",
            storageKey: "support/att_1",
            uploadUrl: "https://upload.example/signed-url",
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, attachment: attachmentFixture })
      )
    const client = createSupportTicketsClient()

    const presigned = await client.presignAttachment({
      target: "create",
      fileName: "error.log",
      mimeType: "text/plain",
      sizeBytes: 12,
    })

    await client.uploadAttachmentObject({
      file: new File(["hello"], "error.log", { type: "text/plain" }),
      uploadUrl: presigned.uploadUrl,
    })

    const registered = await client.registerAttachment({
      id: "att_1",
      target: "create",
      fileName: "error.log",
      mimeType: "text/plain",
      sizeBytes: 12,
      storageBucket: "bucket-a",
      storageKey: "support/att_1",
    })

    expect(presigned.attachmentId).toBe("att_1")
    expect(registered.id).toBe("att_1")
  })

  it("throws when upload object request fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, error: "UPLOAD_FAILED" }, 502)
    )
    const client = createSupportTicketsClient()

    await expect(
      client.uploadAttachmentObject({
        file: new File(["hello"], "error.log", { type: "text/plain" }),
        uploadUrl: "https://upload.example/denied",
      })
    ).rejects.toThrow("Attachment upload failed.")
  })

  it("lists admin tickets", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        tickets: [ticketFixture, { ...ticketFixture, id: "ticket_2" }],
      })
    )
    const client = createSupportTicketsClient()

    const tickets = await client.listAdminTickets()

    expect(tickets).toHaveLength(2)
    expect(tickets[0]?.id).toBe("ticket_1")
    expect(tickets[1]?.id).toBe("ticket_2")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/support-tickets/admin",
      undefined
    )
  })

  it("throws error on admin tickets failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream error", { status: 500 })
    )
    const client = createSupportTicketsClient()

    await expect(client.listAdminTickets()).rejects.toThrow(
      "Unable to load support tickets."
    )
  })

  it("creates admin ticket with custom organization", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, ticket: ticketFixture })
    )
    const client = createSupportTicketsClient()

    const ticket = await client.createAdminTicket({
      organizationId: "org_custom",
      subject: "Admin ticket",
      department: "technical",
      priority: "high",
    })

    expect(ticket.id).toBe("ticket_1")
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: expect.stringContaining("org_custom"),
    })
  })

  it("throws error on admin ticket creation failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 403))
    const client = createSupportTicketsClient()

    await expect(
      client.createAdminTicket({
        organizationId: "org_custom",
        subject: "Admin ticket",
        department: "technical",
        priority: "high",
      })
    ).rejects.toThrow("Unable to create support ticket.")
  })

  it("updates admin ticket with PUT", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, ticket: ticketFixture })
    )
    const client = createSupportTicketsClient()

    const ticket = await client.updateAdminTicket("ticket_1", {
      department: "billing",
      priority: "low",
      status: "in_progress",
    })

    expect(ticket.id).toBe("ticket_1")
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      body: expect.stringContaining("billing"),
    })
  })

  it("deletes admin ticket with DELETE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    const client = createSupportTicketsClient()

    const result = await client.deleteAdminTicket("ticket_1")

    expect(result).toBe(true)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "DELETE",
    })
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/api/support-tickets/admin/ticket_1"
    )
  })

  it("lists admin organizations", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        organizations: [
          { id: "org_1", name: "Org 1" },
          { id: "org_2", name: "Org 2" },
        ],
      })
    )
    const client = createSupportTicketsClient()

    const orgs = await client.listAdminOrganizations()

    expect(orgs).toHaveLength(2)
    expect(orgs[0]?.name).toBe("Org 1")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/support-tickets/admin/organizations",
      undefined
    )
  })

  it("throws error on admin organizations failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream error", { status: 500 })
    )
    const client = createSupportTicketsClient()

    await expect(client.listAdminOrganizations()).rejects.toThrow(
      "Unable to load organizations."
    )
  })

  it("preserves API error message on admin ticket creation", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: "Custom admin error" }, 403)
    )
    const client = createSupportTicketsClient()

    await expect(
      client.createAdminTicket({
        organizationId: "org_custom",
        subject: "Admin ticket",
        department: "technical",
        priority: "high",
      })
    ).rejects.toThrow("Custom admin error")
  })
})
