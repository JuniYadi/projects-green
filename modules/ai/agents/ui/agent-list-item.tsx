import type { KeyboardEvent, MouseEvent } from "react"
import Link from "next/link"
import { DotsThree, Trash, WhatsappLogo } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type {
  AiAgentListItemDTO,
  AiAgentOperationalStatus,
} from "@/modules/ai/agents/ai-agent.dto"

type Copy = {
  noDescription: string
  noChannel: string
  activeOn: string
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

const actionNeededStatuses = new Set<AiAgentOperationalStatus>([
  "DRAFT",
  "NEEDS_ATTENTION",
  "PAUSED",
  "READY_TO_CONNECT",
])

// Static class lists so Tailwind's scanner can find them at build time.
const avatarTones = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
]

const statusRingClass: Record<AiAgentOperationalStatus, string> = {
  ACTIVE: "border-emerald-500 motion-safe:animate-pulse",
  READY_TO_CONNECT: "border-dashed border-muted-foreground/40",
  DRAFT: "border-dashed border-muted-foreground/40",
  NEEDS_ATTENTION: "border-amber-500",
  PAUSED: "border-muted-foreground/30",
  ARCHIVED: "border-muted-foreground/30",
}

const statusDotClass: Record<AiAgentOperationalStatus, string> = {
  ACTIVE: "bg-emerald-500",
  READY_TO_CONNECT: "bg-muted-foreground/50",
  DRAFT: "bg-muted-foreground/50",
  NEEDS_ATTENTION: "bg-amber-500",
  PAUSED: "bg-muted-foreground/40",
  ARCHIVED: "bg-muted-foreground/40",
}

function hashToIndex(input: string, modulo: number) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % modulo
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

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

function statusLine(agent: AiAgentListItemDTO, copy: Copy) {
  const channel = agent.channelBindings[0]
  if (!channel) return copy.noChannel
  if (agent.operationalStatus === "ACTIVE") {
    return copy.activeOn.replace(
      "{target}",
      channel.targetName || channel.targetId || ""
    )
  }
  return copy.statuses[agent.operationalStatus]
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
  const archived = agent.status === "ARCHIVED"
  const toneClass = avatarTones[hashToIndex(agent.name, avatarTones.length)]

  function stop(event: MouseEvent) {
    event.stopPropagation()
  }

  function openAgent() {
    onPrimaryAction(agent)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openAgent()
    }
  }

  return (
    <Card
      data-testid={`agent-card-${agent.id}`}
      role="button"
      tabIndex={0}
      onClick={openAgent}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer border-border focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full border-2 p-0.5",
              statusRingClass[agent.operationalStatus]
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full",
                "text-xs font-semibold",
                toneClass
              )}
            >
              {initials(agent.name)}
            </span>
          </span>
          <div className="min-w-0 space-y-1 pt-0.5">
            <p className="truncate text-base font-medium">{agent.name}</p>
            {agent.description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                &ldquo;{agent.description}&rdquo;
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.actions.delete}
            className="text-muted-foreground hover:text-destructive"
            onClick={(event) => {
              stop(event)
              onDelete(agent)
            }}
          >
            <Trash size={18} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={copy.actions.more}
                onClick={stop}
              >
                <DotsThree size={20} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52"
              onClick={stop}
            >
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
              <DropdownMenuItem
                onSelect={() => onAdvancedAction(agent, "embed")}
              >
                {copy.actions.embed}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onAdvancedAction(agent, "tools")}
              >
                {copy.actions.tools}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {archived ? (
                <DropdownMenuItem
                  onSelect={() => onStatusChange(agent, "DRAFT")}
                >
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-xs",
              "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                statusDotClass[agent.operationalStatus]
              )}
            />
            <WhatsappLogo size={14} className="shrink-0" />
            <span className="truncate">{statusLine(agent, copy)}</span>
          </span>
          {actionNeededStatuses.has(agent.operationalStatus) ? (
            <Button
              size="sm"
              onClick={(event) => {
                stop(event)
                onPrimaryAction(agent)
              }}
            >
              {primaryLabel(agent, copy)}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
