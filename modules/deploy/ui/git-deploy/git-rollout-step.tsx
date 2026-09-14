"use client"

import { useState } from "react"
import {
  ArrowSquareOut,
  CheckCircle,
  Spinner,
  Terminal,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  const [activeTab, setActiveTab] = useState<"build" | "runtime">("build")

  // Mock initial streaming log lines
  const buildLogs = [
    `[INFO] Initializing build environment for ${source.url} (ref: ${source.branch})`,
    `[INFO] Pulling builder image from registry-apac.pfnapp.com/builders/node:20-alpine`,
    `[INFO] Cloning repository into workspace /workspace/source ...`,
    `[INFO] Checking out commit HEAD on branch '${source.branch}' (depth 1)`,
    `[INFO] Executing build command: pnpm run build`,
    `[INFO] > next build`,
    `[INFO] ▲ Next.js 14.2.3`,
    `[INFO]   - Environments: .env.production`,
    `[INFO]   - Creating an optimized production build ...`,
    `[INFO]   ✓ Compiled successfully in 14.8s`,
    `[INFO] Packaging standalone OCI container image ...`,
    `[INFO] Pushing image to registry-apac.pfnapp.com/app-${sizing.subdomain}:${deploymentId}`,
    `[INFO] Generating Helm values and syncing manifests to GitOps repository ...`,
    `[INFO] ArgoCD rollout triggered on namespace app-${sizing.subdomain} (cluster: sgp-k8s-prod-01)`,
  ]

  const liveUrl = `https://${sizing.subdomain}.pfnapp.dev`

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle Progress Stepper */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold">Deployment Rollout</h2>
            <p className="font-mono text-xs text-muted-foreground">
              ID: {deploymentId} · Target: {source.branch}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-700"
          >
            Rolling Out
          </Badge>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-foreground">
              1. Source Cloned
            </span>
            <span className="text-[11px] text-muted-foreground">
              0.8s elapsed
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-foreground">
              2. Image Built
            </span>
            <span className="text-[11px] text-muted-foreground">
              18.4s elapsed
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Spinner className="h-5 w-5 animate-spin text-primary" />
            <span className="font-semibold text-foreground">
              3. K8s Rollout
            </span>
            <span className="text-[11px] text-primary">In progress…</span>
          </div>

          <div className="flex flex-col items-center gap-1.5 opacity-50">
            <div className="h-5 w-5 rounded-full border border-border" />
            <span className="font-medium text-muted-foreground">
              4. Healthy & Live
            </span>
            <span className="text-[11px] text-muted-foreground">
              Pending probe
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
              Deployment Logs
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "build" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab("build")}
            >
              Build Logs
            </Button>
            <Button
              variant={activeTab === "runtime" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab("runtime")}
            >
              Pod Runtime
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
            <span>Streaming live cluster events…</span>
          </div>
        </div>
      </div>

      {/* Live Endpoint Action Card */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row">
        <div>
          <p className="text-xs text-muted-foreground uppercase">
            Application Public Ingress
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
            Visit Application
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Deploy Another Project
          </Button>
        </div>
      </div>
    </div>
  )
}
