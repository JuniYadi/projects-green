import Link from "next/link"
import { DotsThree, WhatsappLogo } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  AiAgentListItemDTO,
  AiAgentOperationalStatus,
} from "@/modules/ai/agents/ai-agent.dto"

type Copy = {
  noDescription: string
  noChannel: string
  updated: string
  statuses: Record<AiAgentOperationalStatus, string>
  actions: {
    open: string
    continueSetup: string
    connect: string
    repair: string
    reactivate: string
    edit: string
    canvas: string
    simulator: string
    embed: string
    tools: string
    pause: string
    archive: string
    restore: string
    delete: string
    more: string
  }
}

type Props = {
  agent: AiAgentListItemDTO
  lang: string
  copy: Copy
  onPrimaryAction: (agent: AiAgentListItemDTO) => void
  onEdit: (agent: AiAgentListItemDTO) => void
  onAdvancedAction: (
    agent: AiAgentListItemDTO,
    action: "simulator" | "embed" | "tools"
  ) => void
  onStatusChange: (
    agent: AiAgentListItemDTO,
    status: "ACTIVE" | "ARCHIVED" | "DRAFT" | "PAUSED"
  ) => void
  onDelete: (agent: AiAgentListItemDTO) => void
}

const warningStatuses = new Set<AiAgentOperationalStatus>([
  "DRAFT",
  "NEEDS_ATTENTION",
  "READY_TO_CONNECT",
])

function primaryLabel(agent: AiAgentListItemDTO, copy: Copy) {
  switch (agent.operationalStatus) {
    case "ACTIVE":
      return copy.actions.open
    case "READY_TO_CONNECT":
      return copy.actions.connect
    case "NEEDS_ATTENTION":
      return copy.actions.repair
    case "PAUSED":
      return agent.activeChannelsCount > 0
        ? copy.actions.reactivate
        : copy.actions.connect
    default:
      return copy.actions.continueSetup
  }
}

export function AgentListItem({
  agent,
  lang,
  copy,
  onPrimaryAction,
  onEdit,
  onAdvancedAction,
  onStatusChange,
  onDelete,
}: Props) {
  const firstChannel = agent.channelBindings[0]
  const archived = agent.status === "ARCHIVED"

  return (
    <Card data-testid={`agent-card-${agent.id}`} className="border-border">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <CardTitle className="truncate text-base">{agent.name}</CardTitle>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {agent.description || copy.noDescription}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={copy.actions.more}>
              <DotsThree size={20} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onEdit(agent)}>
              {copy.actions.edit}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={
                  `/${lang}/console/ai/agents/${agent.id}/canvas?` +
                  `agentProfileId=${agent.id}&agentProfileName=` +
                  encodeURIComponent(agent.name)
                }
              >
                {copy.actions.canvas}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onAdvancedAction(agent, "simulator")}
            >
              {copy.actions.simulator}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAdvancedAction(agent, "embed")}>
              {copy.actions.embed}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAdvancedAction(agent, "tools")}>
              {copy.actions.tools}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {archived ? (
              <DropdownMenuItem onSelect={() => onStatusChange(agent, "DRAFT")}>
                {copy.actions.restore}
              </DropdownMenuItem>
            ) : (
              <>
                {agent.status === "ACTIVE" ? (
                  <DropdownMenuItem
                    onSelect={() => onStatusChange(agent, "PAUSED")}
                  >
                    {copy.actions.pause}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => onStatusChange(agent, "ARCHIVED")}
                >
                  {copy.actions.archive}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(agent)}
            >
              {copy.actions.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              agent.operationalStatus === "ACTIVE" ? "secondary" : "outline"
            }
            className={
              agent.operationalStatus === "ACTIVE"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : warningStatuses.has(agent.operationalStatus)
                  ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground"
            }
          >
            {copy.statuses[agent.operationalStatus]}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WhatsappLogo size={15} />
            {firstChannel?.targetName ||
              firstChannel?.targetId ||
              copy.noChannel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-xs text-muted-foreground">
            {copy.updated} {new Date(agent.updatedAt).toLocaleDateString(lang)}
          </span>
          {!archived ? (
            <Button size="sm" onClick={() => onPrimaryAction(agent)}>
              {primaryLabel(agent, copy)}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
