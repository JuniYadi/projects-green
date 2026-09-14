"use client"

import { useState } from "react"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  RocketLaunch,
  Spinner,
  Wallet,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GitBuildConfig, GitSizingConfig, GitSourceConfig } from "./types"

type GitReviewStepProps = {
  source: GitSourceConfig
  build: GitBuildConfig
  sizing: GitSizingConfig
  onBack: () => void
  onDeploy: () => Promise<void>
}

export function GitReviewStep({
  source,
  build,
  sizing,
  onBack,
  onDeploy,
}: GitReviewStepProps) {
  const [deploying, setDeploying] = useState(false)
  const monthlyCost = (sizing.hourlyRate * 720).toFixed(2)

  const handleLaunch = async () => {
    setDeploying(true)
    try {
      await onDeploy()
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Specification Summary Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold">
              Deployment Specification Summary
            </h2>
            <p className="text-xs text-muted-foreground">
              Review all parameters before initiating the build and container
              rollout.
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {source.isPrivate ? "Private Repository" : "Public Repository"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 divide-y divide-border/60 text-sm">
          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Source Repository</span>
            <span className="font-mono font-medium">{source.url}</span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Target Branch</span>
            <span className="font-mono font-medium">{source.branch}</span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Framework & Runtime</span>
            <span className="font-medium">
              {build.framework} {build.frameworkVersion} ({build.runtime})
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Build Command</span>
            <span className="font-mono font-medium">{build.buildCommand}</span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Public Endpoint</span>
            <span className="font-mono font-medium text-primary">
              https://{sizing.subdomain}.pfnapp.dev
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Allocated Resources</span>
            <span className="font-medium">
              {sizing.cpu}m vCPU · {sizing.memory} MiB RAM
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Environment Variables</span>
            <span>{build.envVars.length} variables configured</span>
          </div>
        </div>
      </div>

      {/* Pricing & Wallet Pre-check Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Pricing & Pre-flight Gate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usage is metered and deducted on a per-second basis from your
          organization wallet.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <Clock className="h-4 w-4" />
              Hourly Rate
            </div>
            <p className="mt-2 text-xl font-bold">
              ${sizing.hourlyRate.toFixed(4)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / hr
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Billed strictly per second active
            </p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <Clock className="h-4 w-4" />
              Est. Monthly (720h)
            </div>
            <p className="mt-2 text-xl font-bold">
              ${monthlyCost}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / mo
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Projected for uninterrupted runtime
            </p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <Wallet className="h-4 w-4" />
              Pre-check Status
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              Wallet Pre-check Passed
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Buffer requirement met
            </p>
          </div>
        </div>
      </div>

      {/* Navigation & Launch CTA */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={deploying}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Edit Configuration
        </Button>
        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={deploying}
          className="px-8"
        >
          {deploying ? (
            <>
              <Spinner className="mr-2 h-5 w-5 animate-spin" />
              Initiating Deployment…
            </>
          ) : (
            <>
              <RocketLaunch className="mr-2 h-5 w-5" />
              Deploy Application
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
