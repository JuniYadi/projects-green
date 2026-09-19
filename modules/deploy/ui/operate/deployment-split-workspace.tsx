"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  ArrowClockwise,
  GitBranch,
  GitCommit,
  Timer,
  User,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"
import type {
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type {
  DeployLogScope,
  DeployStatus,
} from "@/modules/deploy/deploy.types"
import { DeployStepTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { JenkinsLiveTerminal } from "./jenkins-live-terminal"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type DeploymentSplitWorkspaceProps = {
  stack: StackSummaryDTO
  deployment: DeploymentStatusDTO | null
  deployId: string
  status: DeployStatus
  logScope?: DeployLogScope
  onLogScopeChange?: (scope: DeployLogScope) => void
  onRetry?: () => void
  liveDomain?: string
  locale?: string
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—"
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`
}

export function DeploymentSplitWorkspace({
  stack,
  deployment,
  deployId,
  status,
  logScope,
  onLogScopeChange,
  onRetry,
  liveDomain,
  locale: localeProp,
}: DeploymentSplitWorkspaceProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const tMonitor = messages.console.app.timeline.monitor
  const tone = STATUS_TONE[status] ?? STATUS_TONE.idle

  const [renderTick, setRenderTick] = useState(() => Date.now())

  useEffect(() => {
    if (!deployment?.startedAt || deployment?.completedAt) return
    const timer = setInterval(() => {
      setRenderTick(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [deployment?.startedAt, deployment?.completedAt])

  const elapsedMs = deployment?.startedAt
    ? Math.max(
        0,
        deployment.completedAt
          ? new Date(deployment.completedAt).getTime() -
              new Date(deployment.startedAt).getTime()
          : renderTick - new Date(deployment.startedAt).getTime()
      )
    : null

  const commitSha =
    deployment?.commitSha && deployment.commitSha.trim().length > 0
      ? deployment.commitSha.slice(0, 7)
      : null

  return (
    <div
      data-testid="deployment-split-workspace"
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
    >
      {/* Column 1 (Left, ~40% / 5 cols): Status, Metadata & Truthful 6-Step Timeline */}
      <div className="col-span-12 space-y-4 lg:col-span-5">
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>
                    {messages.pDeployOperateAppMonitor.attemptLabel} #
                    {deployment ? deployment.attempt : 1}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
                  >
                    {DEPLOY_STATUS_LABELS[status] ?? status}
                  </span>
                </CardTitle>
                <CardDescription className="pt-1 text-xs">
                  {tMonitor.statusDescription}
                </CardDescription>
              </div>

              {status === "failed" && onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-8 gap-1.5 text-xs"
                >
                  <ArrowClockwise className="size-3.5" />
                  <span>{messages.pDeployOperateAppMonitor.retryDeploy}</span>
                </Button>
              )}
            </div>

            {/* Quick deployment meta badges */}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Timer className="size-3.5 shrink-0 text-foreground" />
                <span>
                  Dur:{" "}
                  <strong className="font-medium text-foreground">
                    {formatDuration(elapsedMs)}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <GitBranch className="size-3.5 shrink-0 text-foreground" />
                <span className="truncate">{stack.branchName || "main"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <GitCommit className="size-3.5 shrink-0 text-foreground" />
                <span>
                  Commit:{" "}
                  <code className="font-mono text-foreground">
                    {commitSha || "head"}
                  </code>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="size-3.5 shrink-0 text-foreground" />
                <span className="truncate">
                  {stack.sourceType === "TEMPLATE" ? "Template" : "Git Webhook"}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            <div className="border-t border-border pt-3">
              <h4 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {tMonitor.timelineTitle}
              </h4>
              <DeployStepTimeline
                deployId={deployId}
                status={status}
                liveDomain={liveDomain}
                skipBuildSteps={stack.sourceType === "TEMPLATE"}
                onRetry={status === "failed" ? onRetry : undefined}
                locale={locale}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column 2 (Right, ~60% / 7 cols): Live Jenkins Runner Terminal */}
      <div className="col-span-12 lg:col-span-7">
        <JenkinsLiveTerminal
          slug={stack.slug}
          deployId={deployId}
          status={status}
          failureReason={deployment?.failureReason ?? null}
          initialTab={
            logScope === "runtime"
              ? "app"
              : logScope === "build"
                ? "jenkins"
                : undefined
          }
          onTabChange={(tab) => {
            if (onLogScopeChange) {
              onLogScopeChange(
                tab === "app" ? "runtime" : tab === "jenkins" ? "build" : "all"
              )
            }
          }}
          onRetry={onRetry}
          locale={locale}
        />
      </div>
    </div>
  )
}
