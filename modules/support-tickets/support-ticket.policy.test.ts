import { describe, expect, it } from "bun:test"

import {
  canCreateSupportTicketInternalReply,
  canReadSupportTicket,
  canUpdateSupportTicketStatus,
  isSupportTicketStatusTransitionAllowed,
} from "@/modules/support-tickets/support-ticket.policy"
import type { SupportTicketOwnership } from "@/modules/support-tickets/support-ticket.types"

const ownership: SupportTicketOwnership = {
  organizationId: "org_1",
  requesterWorkosUserId: "user_requester",
  assignedAgentWorkosUserId: "user_agent",
}

describe("support ticket status transitions", () => {
  it("allows baseline lifecycle transitions", () => {
    expect(isSupportTicketStatusTransitionAllowed("open", "in_progress")).toBe(
      true
    )
    expect(
      isSupportTicketStatusTransitionAllowed("in_progress", "resolved")
    ).toBe(true)
    expect(isSupportTicketStatusTransitionAllowed("resolved", "closed")).toBe(
      true
    )
    expect(
      isSupportTicketStatusTransitionAllowed("resolved", "in_progress")
    ).toBe(true)
  })

  it("rejects invalid transitions and no-op transitions", () => {
    expect(isSupportTicketStatusTransitionAllowed("open", "open")).toBe(false)
    expect(isSupportTicketStatusTransitionAllowed("closed", "open")).toBe(false)
    expect(isSupportTicketStatusTransitionAllowed("closed", "resolved")).toBe(
      false
    )
  })
})

describe("support ticket ownership access", () => {
  it("allows requester and assigned agent to read", () => {
    expect(
      canReadSupportTicket(
        {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        ownership
      )
    ).toBe(true)

    expect(
      canReadSupportTicket(
        {
          organizationId: "org_1",
          workosUserId: "user_agent",
        },
        ownership
      )
    ).toBe(true)
  })

  it("requires manage/agent privilege for status updates", () => {
    expect(
      canUpdateSupportTicketStatus(
        {
          organizationId: "org_1",
          workosUserId: "user_agent",
        },
        ownership
      )
    ).toBe(true)

    expect(
      canUpdateSupportTicketStatus(
        {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        ownership
      )
    ).toBe(false)

    expect(
      canUpdateSupportTicketStatus(
        {
          canManageTickets: true,
          organizationId: "org_1",
          workosUserId: "user_manager",
        },
        ownership
      )
    ).toBe(true)
  })

  it("limits internal replies to manager/assigned agent or super admin", () => {
    expect(
      canCreateSupportTicketInternalReply(
        {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        ownership
      )
    ).toBe(false)

    expect(
      canCreateSupportTicketInternalReply(
        {
          organizationId: "org_1",
          workosUserId: "user_agent",
        },
        ownership
      )
    ).toBe(true)

    expect(
      canCreateSupportTicketInternalReply(
        {
          isSuperAdmin: true,
          organizationId: "org_other",
          workosUserId: "user_super_admin",
        },
        ownership
      )
    ).toBe(true)
  })
})
