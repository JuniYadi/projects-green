import { describe, expect, it } from "bun:test"

describe("support ticket prisma models", () => {
  it("defines enums, ticket model, and reply model", async () => {
    const schema = await Bun.file("prisma/schema.prisma").text()

    expect(schema).toContain("enum SupportTicketDepartment {")
    expect(schema).toContain("enum SupportTicketStatus {")

    expect(schema).toContain("model SupportTicket {")
    expect(schema).toContain("status                    SupportTicketStatus")
    expect(schema).toContain("attachmentsJson           Json?")
    expect(schema).toContain("replies SupportTicketReply[]")
    expect(schema).toContain("@@index([organizationId, status])")

    expect(schema).toContain("model SupportTicketReply {")
    expect(schema).toContain("isInternalNote   Boolean  @default(false)")
    expect(schema).toContain(
      "@relation(fields: [ticketId], references: [id], onDelete: Cascade)"
    )
  })
})
