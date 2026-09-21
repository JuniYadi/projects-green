"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowClockwise } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
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
import type { LogSourceTab } from "./jenkins-live-terminal"
import type { JenkinsStage } from "./jenkins-live-terminal"
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
  // forceTab carries a seq counter so clicking the same timeline step twice in
  // a row always produces a new object reference and reliably fires the effect
  // inside JenkinsLiveTerminal even when the tab value hasn't changed.
  const [forcedTab, setForcedTab] = useState<
    { tab: LogSourceTab; seq: number } | undefined
  >(undefined)
  const forcedTabSeqRef = useRef(0)
  const [jenkinsStages, setJenkinsStages] = useState<JenkinsStage[]>([])
  const [selectedJenkinsStage, setSelectedJenkinsStage] = useState<string | null>(
    null
  )
  const initialStepIndex =
    logScope === "build"
      ? 1
      : logScope === "runtime" || status === "running"
        ? 5
        : status === "deploying"
          ? 3
          : 1
  const [selectedStepIndex, setSelectedStepIndex] = useState(initialStepIndex)

  return (
    <div
      data-testid="deployment-split-workspace"
      className="grid grid-cols-1 items-start gap-6 lg:h-[clamp(500px,68vh,720px)] lg:grid-cols-12 lg:items-stretch"
    >
      {/* Compact navigator on the left; logs get the larger reading surface. */}
      <div className="col-span-12 lg:col-span-4 lg:min-h-0">
        <div className="flex flex-col rounded-lg border border-border bg-card shadow-xs lg:h-full lg:min-h-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">
                {locale === "id" ? "Progres deployment" : "Deployment progress"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                #{deployment?.attempt ?? 1} · {tMonitor.timelineTitle}
              </p>
            </div>
            {status === "failed" && onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry} className="h-7 gap-1 text-xs">
                <ArrowClockwise className="size-3.5" />
                {messages.pDeployOperateAppMonitor.retryDeploy}
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <DeployStepTimeline
                deployId={deployId}
                status={status}
                liveDomain={liveDomain}
                skipBuildSteps={stack.sourceType === "TEMPLATE"}
                onRetry={status === "failed" ? onRetry : undefined}
                locale={locale}
                selectedStepIndex={selectedStepIndex}
                onStepFocus={(tab, stepIndex) => {
                  setSelectedStepIndex(stepIndex)
                  forcedTabSeqRef.current += 1
                  setForcedTab({ tab, seq: forcedTabSeqRef.current })
                  if (tab !== "jenkins") setSelectedJenkinsStage(null)
                }}
                jenkinsStages={jenkinsStages}
                selectedJenkinsStage={selectedJenkinsStage}
                onJenkinsStageFocus={(stage) => {
                  setSelectedJenkinsStage(stage)
                  forcedTabSeqRef.current += 1
                  setForcedTab({ tab: "jenkins", seq: forcedTabSeqRef.current })
                }}
              />
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 lg:min-h-0">
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
          forceTab={forcedTab}
          selectedJenkinsStage={selectedJenkinsStage}
          onJenkinsStagesChange={setJenkinsStages}
          onTabChange={(tab) => {
            setSelectedStepIndex(tab === "jenkins" ? 1 : tab === "gitops" ? 3 : 5)
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
