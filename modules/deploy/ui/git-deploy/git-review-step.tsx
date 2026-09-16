"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  RocketLaunch,
  Spinner,
  Wallet,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getAccount, type BillingAccount } from "@/lib/billing-client"
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
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.deploy.gitDeploy.review
  const [deploying, setDeploying] = useState(false)
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [checkingBalance, setCheckingBalance] = useState(true)
  const monthlyCost = (sizing.hourlyRate * 720).toFixed(2)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await getAccount()
        if (active && res?.ok) {
          setAccount(res)
        }
      } catch {
        // Keep neutral state if billing service is unavailable
      } finally {
        if (active) {
          setCheckingBalance(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

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
            <h2 className="text-base font-semibold">{messages.summaryTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {messages.summaryDesc}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {source.isPrivate ? "Private Repository" : "Public Repository"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 divide-y divide-border/60 text-sm">
          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">{messages.sourceRepo}</span>
            <span className="font-mono font-medium">{source.url}</span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">
              {messages.targetBranch}
            </span>
            <span className="font-mono font-medium">{source.branch}</span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">
              {messages.frameworkRuntime}
            </span>
            <span className="font-medium">
              {build.framework} {build.frameworkVersion} ({build.runtime})
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">
              {messages.buildCommand}
            </span>
            <span className="font-mono font-medium">{build.buildCommand}</span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">
              {messages.publicEndpoint}
            </span>
            <span className="font-mono font-medium text-primary">
              https://{sizing.subdomain}.pfnapp.dev
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">
              {messages.allocatedResources}
            </span>
            <span className="font-medium">
              {sizing.cpu}
              {messages.vcpuSuffix} {sizing.memory} {messages.ramSuffix}
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">{messages.envVars}</span>
            <span>
              {build.envVars.length} {messages.varsConfigured}
            </span>
          </div>
        </div>
      </div>

      {/* Pricing & Wallet Pre-check Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">{messages.pricingPreflight}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.pricingPreflightDesc}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <Clock className="h-4 w-4" />
              {messages.hourlyRate}
            </div>
            <p className="mt-2 text-xl font-bold">
              ${sizing.hourlyRate.toFixed(4)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / hr
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {messages.billedPerSecond}
            </p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <Clock className="h-4 w-4" />
              {messages.estMonthly}
            </div>
            <p className="mt-2 text-xl font-bold">
              ${monthlyCost}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / mo
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {messages.projectedRuntime}
            </p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <Wallet className="h-4 w-4" />
              {messages.precheckStatus}
            </div>
            {checkingBalance ? (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4 animate-spin" />
                {messages.checkingBalance}
              </div>
            ) : account ? (
              account.isPositive ? (
                <>
                  <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    {messages.balanceVerified}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {account.formattedBalance} {messages.available}
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                    <WarningCircle className="h-4 w-4" />
                    {messages.lowBalance}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {account.formattedBalance} {messages.topUpRecommended}
                  </p>
                </>
              )
            ) : (
              <>
                <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50" />
                  {messages.notVerified}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {messages.verifiedUponDeploy}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation & Launch CTA */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={deploying}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {messages.editConfig}
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
              {messages.initiatingDeploy}
            </>
          ) : (
            <>
              <RocketLaunch className="mr-2 h-5 w-5" />
              {messages.deployApp}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
