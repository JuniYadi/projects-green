import type {
  SupportTicketActorContext,
  SupportTicketOwnership,
  SupportTicketStatus,
} from "@/modules/support-tickets/support-ticket.types"

export const SUPPORT_TICKET_STATUS_TRANSITIONS: Record<
  SupportTicketStatus,
  SupportTicketStatus[]
> = {
  open: ["in_progress", "waiting_response", "on_hold", "resolved", "closed"],
  in_progress: ["waiting_response", "on_hold", "resolved", "closed"],
  waiting_response: ["in_progress", "on_hold", "resolved", "closed"],
  on_hold: ["in_progress", "waiting_response", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: [],
}

export class SupportTicketStatusTransitionError extends Error {
  constructor(from: SupportTicketStatus, to: SupportTicketStatus) {
    super(`Cannot transition support ticket from ${from} to ${to}.`)
    this.name = "SupportTicketStatusTransitionError"
  }
}

export const isSupportTicketStatusTransitionAllowed = (
  from: SupportTicketStatus,
  to: SupportTicketStatus
) => {
  if (from === to) {
    return false
  }

  return SUPPORT_TICKET_STATUS_TRANSITIONS[from].includes(to)
}

export const assertSupportTicketStatusTransition = (
  from: SupportTicketStatus,
  to: SupportTicketStatus
) => {
  if (!isSupportTicketStatusTransitionAllowed(from, to)) {
    throw new SupportTicketStatusTransitionError(from, to)
  }
}

const hasOrganizationAccess = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  if (actor.isSuperAdmin) {
    return true
  }

  return actor.organizationId === ownership.organizationId
}

export const isAssignedAgent = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  if (!ownership.assignedAgentWorkosUserId) {
    return false
  }

  return actor.workosUserId === ownership.assignedAgentWorkosUserId
}

const isRequester = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  return actor.workosUserId === ownership.requesterWorkosUserId
}

export const canReadSupportTicket = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  if (!hasOrganizationAccess(actor, ownership)) {
    return false
  }

  if (actor.isSuperAdmin || actor.canManageTickets) {
    return true
  }

  return isRequester(actor, ownership) || isAssignedAgent(actor, ownership)
}

export const canUpdateSupportTicketStatus = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  if (!hasOrganizationAccess(actor, ownership)) {
    return false
  }

  if (actor.isSuperAdmin || actor.canManageTickets) {
    return true
  }

  return isAssignedAgent(actor, ownership)
}

export const canCloseSupportTicket = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  if (!hasOrganizationAccess(actor, ownership)) {
    return false
  }

  if (actor.isSuperAdmin || actor.canManageTickets) {
    return true
  }

  return isRequester(actor, ownership) || isAssignedAgent(actor, ownership)
}

export const canCreateSupportTicketReply = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  return canReadSupportTicket(actor, ownership)
}

export const canCreateSupportTicketInternalReply = (
  actor: SupportTicketActorContext,
  ownership: SupportTicketOwnership
) => {
  if (!hasOrganizationAccess(actor, ownership)) {
    return false
  }

  if (actor.isSuperAdmin) {
    return true
  }

  return Boolean(actor.canManageTickets || isAssignedAgent(actor, ownership))
}
