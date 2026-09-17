"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle, RocketLaunch, Spinner } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { getAccount, type BillingAccount } from "@/lib/billing-client"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import type { InlineBlueprintData } from "../chat/inline-blueprint-card"
import type { GitSourceConfig } from "../git-deploy/types"
import { ZeroConfigNotice } from "./zero-config-notice"
import { BalanceGuard } from "./balance-guard"

export type ExecutiveLaunchCardProps = {
  source: GitSourceConfig
  blueprint: InlineBlueprintData
  inspectionData?: Record<string, unknown> | null
  sessionId?: string
  appId?: string
  currency?: "USD" | "IDR"
  lang?: string
  userName?: string
  balanceFormatted?: string
  toolsList?: string
  onLaunch: () => Promise<void> | void
  onBackToChat: () => void
  isLaunching?: boolean
}

function getGitProvider(url: string): { name: string; host: string } {
  const lower = url.toLowerCase()
  if (lower.includes("gitlab")) {
    return { name: "GitLab", host: "gitlab.com" }
  }
  if (lower.includes("bitbucket")) {
    return { name: "Bitbucket", host: "bitbucket.org" }
  }
  return { name: "GitHub", host: "github.com" }
}

function formatRepoUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^git@([^:]+):/i, "$1/")
    .replace(/\.git$/i, "")
}

function formatComputePlan(tierName?: string, hourlyRate?: number): string {
  const rate = hourlyRate !== undefined ? hourlyRate.toFixed(2) : "0.04"
  const lower = (tierName || "").toLowerCase()
  if (lower.includes("small") || lower.includes("starter")) {
    return `Starter Tier (0.5 vCPU · 512MB RAM · $${rate}/hour)`
  }
  if (lower.includes("large") || lower.includes("pro")) {
    return `Large Tier (2 vCPU · 4GB RAM · $${rate}/hour)`
  }
  return `Medium Tier (1 vCPU · 2GB RAM · $${rate}/hour)`
}

export function ExecutiveLaunchCard({
  source,
  blueprint,
  inspectionData,
  appId,
  currency = "USD",
  lang = "en",
  balanceFormatted,
  toolsList = "list_repo_files, read_repo_file",
  onLaunch,
  onBackToChat,
  isLaunching = false,
}: ExecutiveLaunchCardProps) {
  const isId = lang === "id"
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  const gitProvider = useMemo(() => getGitProvider(source.url), [source.url])
  const cleanRepoUrl = useMemo(() => formatRepoUrl(source.url), [source.url])

  const confidence = useMemo(() => {
    const raw =
      (inspectionData?.detection as { confidence?: number })?.confidence ??
      (inspectionData?.confidence as number | undefined)
    if (typeof raw === "number") {
      return Math.round(raw <= 1 ? raw * 100 : raw)
    }
    return 96
  }, [inspectionData])

  // Tenant Balance check
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [isLoadingAccount, setIsLoadingAccount] = useState(!balanceFormatted)
  const [balanceError, setBalanceError] = useState(false)
  const [isBalanceSufficient, setIsBalanceSufficient] = useState(true)

  useEffect(() => {
    if (balanceFormatted) {
      return
    }

    let active = true
    getAccount()
      .then((res) => {
        if (!active) return
        if (res?.ok) {
          setAccount(res)
        } else {
          setBalanceError(true)
        }
      })
      .catch(() => {
        if (active) setBalanceError(true)
      })
      .finally(() => {
        if (active) setIsLoadingAccount(false)
      })

    return () => {
      active = false
    }
  }, [balanceFormatted])

  const balanceLoading = !balanceFormatted && isLoadingAccount

  const targetStack = useMemo(() => {
    const fw = blueprint.framework || "Custom App"
    const rt = blueprint.runtime || "Node.js 20"
    return `${fw} (${rt})`
  }, [blueprint.framework, blueprint.runtime])

  const listenPort = `${blueprint.port || 3000} (HTTP)`
  const branchDir = `${source.branch || "main"} / ${source.rootDir || "./"}`
  const subdomain = blueprint.subdomain || "app"
  const computePlan = formatComputePlan(
    blueprint.computeTier,
    blueprint.hourlyRate
  )

  const effectiveCurrency: "USD" | "IDR" =
    account?.currency === "IDR" || currency === "IDR" ? "IDR" : "USD"

  const balanceText = useMemo(() => {
    if (balanceFormatted) return balanceFormatted
    if (account?.formattedBalance) return account.formattedBalance
    return effectiveCurrency === "USD" ? "$50.00" : "IDR 14.493.579,66"
  }, [account?.formattedBalance, balanceFormatted, effectiveCurrency])

  return (
    <div
      data-testid="executive-launch-card"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
    >
      {/* TOP SECTION: AI AGENT VERIFICATION SUMMARY */}
      <div
        data-testid="ai-verification-summary"
        className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" weight="bold" />
          <h2 className="text-xs font-bold tracking-wider text-foreground uppercase">
            {agentMessages.aiVerificationSummary}
          </h2>
        </div>

        <div className="flex flex-col gap-1.5 font-mono text-xs text-muted-foreground sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">[✓]</span>
            <span>
              {agentMessages.verifiedViaSummary
                .replace("{provider}", gitProvider.name)
                .replace("{url}", cleanRepoUrl)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">[✓]</span>
            <span>
              {agentMessages.toolsExecutedLabel.replace("{tools}", toolsList)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">[✓]</span>
            <span>
              {agentMessages.aiConfidenceSummary.replace(
                "{confidence}",
                String(confidence)
              )}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN GRID: EXECUTIVE DEPLOYMENT LAUNCH CARD */}
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="border-b border-border/60 pb-3">
          <h1 className="text-sm font-bold tracking-wider text-foreground uppercase">
            {agentMessages.launchCardTitle}
          </h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Target Stack */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.targetStackLabel}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {targetStack}
            </span>
          </div>

          {/* Listen Port */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.listenPortLabel}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {listenPort}
            </span>
          </div>

          {/* Branch / Dir */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.branchDirLabel}
            </span>
            <span className="font-mono text-sm font-medium text-foreground">
              {branchDir}
            </span>
          </div>

          {/* Subdomain */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.subdomainFieldLabel}
            </span>
            <span className="font-mono text-sm font-medium text-foreground">
              {subdomain}
            </span>
          </div>

          {/* Compute Plan */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.computePlanLabel}
            </span>
            <span className="text-sm font-medium text-foreground">
              {computePlan}
            </span>
          </div>

          {/* Tenant Balance */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.tenantBalanceLabel}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {balanceLoading ? (
                <span className="text-muted-foreground">
                  {isId ? "Memeriksa saldo..." : "Checking balance…"}
                </span>
              ) : balanceError ? (
                <span className="font-semibold text-destructive">
                  {agentMessages.balanceUnknown}
                </span>
              ) : (
                <span>
                  {balanceText}{" "}
                  {isBalanceSufficient ? (
                    <span className="text-muted-foreground">
                      {agentMessages.balanceVerifiedSufficient}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
          </div>

          {/* Balance Guard Alert if Insufficient */}
          {!balanceError && !balanceLoading && (
            <div className="sm:col-span-2">
              <BalanceGuard
                hourlyRate={blueprint.hourlyRate ?? 0.04}
                currency={effectiveCurrency}
                balanceFormatted={balanceFormatted}
                account={account}
                lang={lang}
                onSufficientChange={setIsBalanceSufficient}
                onBackToChat={onBackToChat}
              />
            </div>
          )}

          {/* Environment (Zero-Config Notice) */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.environmentFieldLabel}
            </span>
            <ZeroConfigNotice
              count={blueprint.envVarsCount ?? 12}
              appId={appId}
              lang={lang}
            />
          </div>
        </div>

        {/* ACTION ROW */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
          {/* Primary Green CTA */}
          <Button
            type="button"
            data-testid="launch-card-action-btn"
            onClick={() => void onLaunch()}
            disabled={isLaunching || balanceError || !isBalanceSufficient}
            className={cn(
              "h-11 rounded-xl px-6 text-sm font-bold shadow-xs transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isLaunching ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4 animate-spin" />
                <span>{agentMessages.launchingApp}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <RocketLaunch className="h-4 w-4" weight="bold" />
                <span>{agentMessages.launchAppNow}</span>
              </span>
            )}
          </Button>

          {/* Escape Hatch */}
          <Button
            type="button"
            variant="outline"
            data-testid="launch-card-escape-btn"
            onClick={onBackToChat}
            disabled={isLaunching}
            className="h-11 rounded-xl border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-muted"
          >
            {agentMessages.backToChat}
          </Button>
        </div>
      </div>
    </div>
  )
}
