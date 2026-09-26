import type {
  AiAgentProfile,
  AiAgentStatus,
  AiChannelBinding,
} from "@prisma/client"

export type AiAgentOperationalStatus =
  | "ACTIVE"
  | "ARCHIVED"
  | "DRAFT"
  | "NEEDS_ATTENTION"
  | "PAUSED"
  | "READY_TO_CONNECT"

type ListAgent = AiAgentProfile & {
  channelBindings: Pick<
    AiChannelBinding,
    "channel" | "id" | "isActive" | "targetId" | "targetName"
  >[]
  _count?: {
    knowledgeDocuments: number
    actionIntents: number
  }
}

export type AiAgentListItemDTO = {
  id: string
  name: string
  description: string | null
  status: AiAgentStatus
  operationalStatus: AiAgentOperationalStatus
  activeChannelsCount: number
  channelBindings: ListAgent["channelBindings"]
  knowledgeCount: number
  actionCount: number
  createdAt: Date
  updatedAt: Date
}

export type AiAgentDetailDTO = AiAgentListItemDTO & {
  systemPrompt: string
  dailyUserLimit: number
  enableProfanityFilter: boolean
  allowInteractiveReplies: boolean
  allowedDomains: string[]
  widgetColor: string | null
  widgetPosition: string | null
  welcomeMessage: string | null
}

function hasMinimumConfiguration(agent: ListAgent) {
  return Boolean(agent.name.trim() && agent.systemPrompt.trim())
}

export function toAiAgentDetailDTO(agent: ListAgent): AiAgentDetailDTO {
  return {
    ...toAiAgentListItemDTO(agent),
    systemPrompt: agent.systemPrompt,
    dailyUserLimit: agent.dailyUserLimit,
    enableProfanityFilter: agent.enableProfanityFilter,
    allowInteractiveReplies: agent.allowInteractiveReplies,
    allowedDomains: agent.allowedDomains,
    widgetColor: agent.widgetColor,
    widgetPosition: agent.widgetPosition,
    welcomeMessage: agent.welcomeMessage,
  }
}

export function toAiAgentListItemDTO(agent: ListAgent): AiAgentListItemDTO {
  const activeBindings = agent.channelBindings.filter((binding) =>
    Boolean(binding.isActive)
  )
  let operationalStatus: AiAgentOperationalStatus

  if (agent.status === "ARCHIVED") operationalStatus = "ARCHIVED"
  else if (agent.status === "PAUSED") operationalStatus = "PAUSED"
  else if (agent.status === "ACTIVE") {
    operationalStatus = activeBindings.length > 0 ? "ACTIVE" : "NEEDS_ATTENTION"
  } else {
    operationalStatus = hasMinimumConfiguration(agent)
      ? "READY_TO_CONNECT"
      : "DRAFT"
  }

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    operationalStatus,
    activeChannelsCount: activeBindings.length,
    channelBindings: activeBindings,
    knowledgeCount: agent._count?.knowledgeDocuments ?? 0,
    actionCount: agent._count?.actionIntents ?? 0,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }
}
