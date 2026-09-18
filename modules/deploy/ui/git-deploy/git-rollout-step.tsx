"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import {
  ArrowSquareOut,
  CheckCircle,
  Spinner,
  Terminal,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { GitSizingConfig, GitSourceConfig } from "./types"

type GitRolloutStepProps = {
  source: GitSourceConfig
  sizing: GitSizingConfig
  deploymentId?: string
  onReset: () => void
}

export function GitRolloutStep({
  source,
  sizing,
  deploymentId = "dep-initial",
  onReset,
}: GitRolloutStepProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [activeTab, setActiveTab] = useState<"build" | "runtime">("build")

  // TODO: Replace static build logs placeholder with real-time SSE / WebSocket streaming log consumer from /api/deploy/build-logs or OpenSearch
  const buildLogs = [
    `[INFO] Initializing build environment for ${source.url} (ref: ${source.branch})`,
    `[INFO] Pulling builder image from registry-apac.pfnapp.com/builders/base`,
    `[INFO] Cloning repository into workspace /workspace/source ...`,
    `[INFO] Checking out commit HEAD on branch '${source.branch}' (depth 1)`,
    `[INFO] Running automated buildpack compilation and packaging ...`,
    `[INFO] Packaging standalone OCI container image ...`,
    `[INFO] Pushing image to registry-apac.pfnapp.com/app-${sizing.subdomain}:${deploymentId}`,
    `[INFO] Generating Helm values and syncing manifests to GitOps repository ...`,
    `[INFO] ArgoCD rollout triggered on namespace app-${sizing.subdomain} (cluster: sgp-k8s-prod-01)`,
  ]

  const baseDomain = sizing.managedBaseDomain || "sg.pfnapp.dev"
  const liveUrl = `https://${sizing.subdomain}.${baseDomain}`

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle Progress Stepper */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold">
              {messages.pDeployGitDeployGitRolloutStep.title}
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              {messages.pDeployGitDeployGitRolloutStep.idLabel} {deploymentId}{" "}
              {messages.pDeployGitDeployGitRolloutStep.targetLabel}{" "}
              {source.branch}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-700"
          >
            {messages.pDeployGitDeployGitRolloutStep.statusRollingOut}
          </Badge>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-foreground">
              {messages.pDeployGitDeployGitRolloutStep.stepSourceCloned}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {messages.pDeployGitDeployGitRolloutStep.sourceClonedElapsed}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-foreground">
              {messages.pDeployGitDeployGitRolloutStep.stepImageBuilt}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {messages.pDeployGitDeployGitRolloutStep.imageBuiltElapsed}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Spinner className="h-5 w-5 animate-spin text-primary" />
            <span className="font-semibold text-foreground">
              {messages.pDeployGitDeployGitRolloutStep.stepK8sRollout}
            </span>
            <span className="text-[11px] text-primary">
              {messages.pDeployGitDeployGitRolloutStep.k8sRolloutInProgress}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 opacity-50">
            <div className="h-5 w-5 rounded-full border border-border" />
            <span className="font-medium text-muted-foreground">
              {messages.pDeployGitDeployGitRolloutStep.stepHealthyLive}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {messages.pDeployGitDeployGitRolloutStep.pendingProbe}
            </span>
          </div>
        </div>
      </div>

      {/* Live Terminal & Logs */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              {messages.pDeployGitDeployGitRolloutStep.deploymentLogsHeading}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "build" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab("build")}
            >
              {messages.pDeployGitDeployGitRolloutStep.buildLogsTab}
            </Button>
            <Button
              variant={activeTab === "runtime" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab("runtime")}
            >
              {messages.pDeployGitDeployGitRolloutStep.podRuntimeTab}
            </Button>
          </div>
        </div>

        <div className="max-h-[380px] space-y-1 overflow-y-auto bg-zinc-950 p-4 font-mono text-xs text-zinc-300">
          {buildLogs.map((line, idx) => (
            <div key={idx} className="leading-relaxed">
              {line}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 text-primary">
            <Spinner className="h-3.5 w-3.5 animate-spin" />
            <span>
              {messages.pDeployGitDeployGitRolloutStep.streamingClusterEvents}
            </span>
          </div>
        </div>
      </div>

      {/* Live Endpoint Action Card */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row">
        <div>
          <p className="text-xs text-muted-foreground uppercase">
            {messages.pDeployGitDeployGitRolloutStep.publicIngressLabel}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-primary">
            {liveUrl}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(liveUrl, "_blank")}
          >
            <ArrowSquareOut className="mr-1.5 h-4 w-4" />
            {messages.pDeployGitDeployGitRolloutStep.visitApplication}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            {messages.pDeployGitDeployGitRolloutStep.deployAnotherProject}
          </Button>
        </div>
      </div>
    </div>
  )
}
