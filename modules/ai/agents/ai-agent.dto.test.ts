import { describe, expect, it } from "bun:test"
import { toAiAgentListItemDTO } from "./ai-agent.dto"

function agent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent_1",
    organizationId: "org_1",
    name: "Support",
    description: null,
    systemPrompt: "Help customers",
    fallbackMessage: "Fallback",
    dailyUserLimit: 20,
    maxCharLength: 800,
    enableProfanityFilter: true,
    customBlockedWords: [],
    enableIpProtection: true,
    strikeEscalation: true,
    allowInteractiveReplies: true,
    allowedDomains: [],
    widgetColor: null,
    widgetPosition: null,
    welcomeMessage: null,
    isActive: false,
    status: "DRAFT" as const,
    archivedAt: null,
    createdAt: new Date("2026-09-22T00:00:00Z"),
    updatedAt: new Date("2026-09-22T00:00:00Z"),
    channelBindings: [],
    ...overrides,
  }
}

describe("toAiAgentListItemDTO", () => {
  it("marks configured drafts without channels as ready to connect", () => {
    const dto = toAiAgentListItemDTO(agent())
    expect(dto.operationalStatus).toBe("READY_TO_CONNECT")
    expect(dto.activeChannelsCount).toBe(0)
    expect(dto).not.toHaveProperty("systemPrompt")
  })

  it("does not report active agents without active channels as active", () => {
    const dto = toAiAgentListItemDTO(
      agent({ status: "ACTIVE", isActive: true })
    )
    expect(dto.operationalStatus).toBe("NEEDS_ATTENTION")
  })
})
