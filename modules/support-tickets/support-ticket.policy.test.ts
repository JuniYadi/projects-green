import { describe, expect, it } from "bun:test"

import {
  canCloseSupportTicket,
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
  it("allows forward transitions", () => {
    expect(isSupportTicketStatusTransitionAllowed("open", "in_progress")).toBe(
      true
    )
    expect(isSupportTicketStatusTransitionAllowed("resolved", "closed")).toBe(
      true
    )
  })

  it("blocks same-state and closed reopen", () => {
    expect(isSupportTicketStatusTransitionAllowed("open", "open")).toBe(false)
    expect(isSupportTicketStatusTransitionAllowed("closed", "open")).toBe(false)
  })
})

describe("support ticket ownership access", () => {
  it("grants requester read access", () => {
    expect(
      canReadSupportTicket(
        {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        ownership
      )
    ).toBe(true)
  })

  it("grants assigned agent status update access", () => {
    expect(
      canUpdateSupportTicketStatus(
        {
          organizationId: "org_1",
          workosUserId: "user_agent",
        },
        ownership
      )
    ).toBe(true)
  })

  it("denies status updates for requester", () => {
    expect(
      canUpdateSupportTicketStatus(
        {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        ownership
      )
    ).toBe(false)
  })

  it("allows requester to close ticket", () => {
    expect(
      canCloseSupportTicket(
        {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        ownership
      )
    ).toBe(true)
  })

  it("requires support access for internal replies", () => {
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
  })
})
