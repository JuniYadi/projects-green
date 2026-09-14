"use client"

import {
  CheckCircle,
  GithubLogo,
  LockKey,
  Spinner,
  WarningCircle,
  ArrowRight,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import type { GitAccessState } from "./types"

type AiAgentAccessCheckerProps = {
  accessState: GitAccessState
  accessMessage?: string
  lang?: string
  onInstallApp: () => void
  onRetry: () => void
  onContinue: () => void
}

export function AiAgentAccessChecker({
  accessState,
  accessMessage,
  lang = "en",
  onInstallApp,
  onRetry,
  onContinue,
}: AiAgentAccessCheckerProps) {
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  if (accessState === "idle") return null

  if (accessState === "inspecting") {
    return (
      <div className="flex animate-pulse items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-xs">
        <Spinner className="h-4 w-4 animate-spin text-primary" />
        <span>{agentMessages.evaluatingVisibility}</span>
      </div>
    )
  }

  if (accessState === "public") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-5 w-5 shrink-0" weight="fill" />
          <div>
            <p className="font-medium">{agentMessages.publicVerified}</p>
            <p className="text-xs text-muted-foreground">
              {accessMessage || agentMessages.publicDescription}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onContinue} className="shrink-0 gap-1.5">
          <span>{agentMessages.continueButton}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  if (accessState === "connected") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-5 w-5 shrink-0" weight="fill" />
          <div>
            <p className="font-medium">{agentMessages.privateAuthorized}</p>
            <p className="text-xs text-muted-foreground">
              {accessMessage || agentMessages.privateAuthorizedDescription}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onContinue} className="shrink-0 gap-1.5">
          <span>{agentMessages.continueButton}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  if (accessState === "required") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <LockKey className="h-5 w-5 shrink-0" weight="fill" />
          <div>
            <p className="font-medium">{agentMessages.privateRequired}</p>
            <p className="text-xs text-muted-foreground">
              {accessMessage || agentMessages.privateRequiredDescription}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onInstallApp}
          className="shrink-0 gap-1.5 border-amber-500/30 hover:bg-amber-500/10"
        >
          <GithubLogo className="h-4 w-4" />
          <span>{agentMessages.installApp}</span>
        </Button>
      </div>
    )
  }

  if (accessState === "denied" || accessState === "error") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <WarningCircle className="h-5 w-5 shrink-0" weight="fill" />
          <div>
            <p className="font-medium">{agentMessages.inspectionFailed}</p>
            <p className="text-xs text-muted-foreground">
              {accessMessage || agentMessages.inspectionFailedDesc}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="shrink-0"
        >
          {agentMessages.retryInspection}
        </Button>
      </div>
    )
  }

  return null
}
