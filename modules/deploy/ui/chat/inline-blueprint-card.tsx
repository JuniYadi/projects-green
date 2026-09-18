"use client"

import {
  ChatCircleDots,
  RocketLaunch,
  Spinner,
  Wrench,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type InlineBlueprintData = {
  framework?: string
  runtime?: string
  port?: number
  computeTier?: string
  subdomain?: string
  startCommand?: string
  envVarsCount?: number
  hourlyRate?: number
  currency?: "USD" | "IDR"
  managedBaseDomain?: string
}

export type InlineBlueprintCardProps = {
  blueprint: InlineBlueprintData
  isMutating?: boolean
  onReadyToLaunch: () => void
  onTweakClick?: (field: string) => void
  lang?: string
  className?: string
}

export function InlineBlueprintCard({
  blueprint,
  isMutating = false,
  onReadyToLaunch,
  onTweakClick,
  lang = "en",
  className,
}: InlineBlueprintCardProps) {
  const isId = lang === "id"
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  const frameworkText = blueprint.framework || "Custom App"
  const runtimeText = blueprint.runtime ? ` · ${blueprint.runtime}` : ""
  const stack = `${frameworkText}${runtimeText}`

  const port = `${blueprint.port ?? 3000} (HTTP)`
  const tier = blueprint.computeTier || "Medium (2GB RAM)"
  const isSmall = tier.toLowerCase().includes("small")
  const isRealIdr = blueprint.currency === "IDR"
  const monthlyPriceText = isRealIdr
    ? isSmall
      ? "Rp 20.000 / bulan"
      : "Rp 40.000 / bulan"
    : isSmall
      ? "$2.00 / mo"
      : "$4.00 / mo"
  const compute = `${tier} · ${monthlyPriceText}`

  const baseDomain = blueprint.managedBaseDomain || "sg.pfnapp.dev"
  const domain = `${blueprint.subdomain || "app"}.${baseDomain}`
  const envVars = `${blueprint.envVarsCount ?? 0} keys from .env.example ready`
  const secrets = isId
    ? "Dapat disetel nanti di App Settings"
    : "Can be configured later in App Settings"

  return (
    <div
      data-testid="inline-blueprint-card"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-all",
        isMutating && "ring-1 ring-primary/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase"
          >
            {agentMessages.inlineBlueprintProposal}
          </Badge>
          {isMutating && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <Spinner className="h-3 w-3 animate-spin" />
              <span>{isId ? "Memperbarui..." : "Updating..."}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onTweakClick?.("general")}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Wrench className="h-3 w-3" />
          <span>{isId ? "Tweak lewat chat" : "Tweak via chat"}</span>
        </button>
      </div>

      {/* 2-Column Specification Grid */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1 sm:border-0">
          <span className="font-medium text-muted-foreground">
            {agentMessages.blueprintStack}
          </span>
          <span className="font-semibold text-foreground">{stack}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1 sm:border-0">
          <span className="font-medium text-muted-foreground">
            {agentMessages.blueprintPort}
          </span>
          <span className="font-semibold text-foreground">{port}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1 sm:border-0">
          <span className="font-medium text-muted-foreground">
            {agentMessages.blueprintCompute}
          </span>
          <span className="font-semibold text-foreground">{compute}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1 sm:border-0">
          <span className="font-medium text-muted-foreground">
            {agentMessages.blueprintDomain}
          </span>
          <span className="font-semibold text-foreground">{domain}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1 sm:border-0">
          <span className="font-medium text-muted-foreground">
            {agentMessages.blueprintEnvVars}
          </span>
          <span className="font-medium text-foreground">{envVars}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2 py-1">
          <span className="font-medium text-muted-foreground">
            {agentMessages.blueprintSecrets}
          </span>
          <span className="text-muted-foreground">{secrets}</span>
        </div>
      </div>

      {/* Action Buttons at Bottom */}
      <div className="mt-1 flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          onClick={onReadyToLaunch}
          className="gap-2 bg-primary px-4 font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <RocketLaunch className="h-4 w-4" weight="fill" />
          <span>{agentMessages.readyToDeployCta}</span>
        </Button>

        <button
          type="button"
          onClick={() => onTweakClick?.("port")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChatCircleDots className="h-3.5 w-3.5" />
          <span>{agentMessages.tweakPromptChip}</span>
        </button>
      </div>
    </div>
  )
}
