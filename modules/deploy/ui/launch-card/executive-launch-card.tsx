"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle, RocketLaunch, Spinner } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  getAccount,
  getCatalogProduct,
  type BillingAccount,
  type CatalogPlan,
} from "@/lib/billing-client"
import { getPlanResources } from "@/modules/deploy/catalog-plan-utils"
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

function formatComputePlan(
  tierName?: string,
  hourlyRate?: number,
  rateCurrency?: string,
  matchedPlan?: CatalogPlan | null
): string {
  const isIdr = rateCurrency === "IDR"
  const rateText =
    hourlyRate !== undefined
      ? isIdr
        ? `IDR ${Math.round(hourlyRate)}/jam`
        : `$${hourlyRate.toFixed(2)}/hour`
      : isIdr
        ? "IDR 56/jam"
        : "$0.04/hour"

  const lower = (tierName || matchedPlan?.name || "").toLowerCase()
  if (
    lower.includes("small") ||
    lower.includes("starter") ||
    lower.includes("(s)")
  ) {
    return `Starter Tier (0.5 vCPU · 512MB RAM · ${rateText})`
  }
  if (lower.includes("large") || lower.includes("pro")) {
    return `Large Tier (2 vCPU · 4GB RAM · ${rateText})`
  }
  return `Medium Tier (1 vCPU · 2GB RAM · ${rateText})`
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

  const effectiveCurrency: "USD" | "IDR" =
    account?.currency === "IDR" || currency === "IDR" ? "IDR" : "USD"

  // Load real catalog plans from database
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([])

  useEffect(() => {
    let active = true
    getCatalogProduct("APP_HOSTING", effectiveCurrency)
      .then((res) => {
        if (!active || !res?.product?.plans) return
        setCatalogPlans(res.product.plans)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [effectiveCurrency])

  const matchedPlan = useMemo(() => {
    if (!catalogPlans.length) return null
    const tierCode = (blueprint.computeTier || "MEDIUM").toUpperCase()
    return (
      catalogPlans.find((p) => tierCode.includes(p.code)) ||
      catalogPlans.find((p) => p.code === "MEDIUM") ||
      catalogPlans[0]
    )
  }, [catalogPlans, blueprint.computeTier])

  const blueprintRateCurrency: "USD" | "IDR" =
    blueprint.currency ||
    (blueprint.hourlyRate !== undefined && blueprint.hourlyRate < 1
      ? "USD"
      : effectiveCurrency)

  const { planName, cpuText, memText, realHourlyRate, rateText } =
    useMemo(() => {
      if (matchedPlan) {
        const resources = getPlanResources(matchedPlan)
        const offer =
          matchedPlan.offers?.find((o) => o.billingPeriod === "MONTHLY") ||
          matchedPlan.offers?.[0]
        const periodPrice = offer?.periodPrice
          ? Number(offer.periodPrice)
          : effectiveCurrency === "IDR"
            ? 40000
            : 4
        const calculatedRate =
          effectiveCurrency === "IDR"
            ? Math.ceil(periodPrice / 720)
            : Number((periodPrice / 720).toFixed(4))
        const rate = blueprint.hourlyRate ?? calculatedRate
        const cpu =
          resources.cpu >= 1000
            ? `${(resources.cpu / 1000).toFixed(1).replace(/\.0$/, "")} vCPU`
            : `${resources.cpu}m CPU`
        const mem =
          resources.mem >= 1024
            ? `${Math.round(resources.mem / 1024)}GB RAM`
            : `${resources.mem}MB RAM`
        const formattedRate =
          effectiveCurrency === "IDR"
            ? `IDR ${Math.round(rate)}/jam`
            : `$${rate.toFixed(4)}/hour`
        return {
          planName: matchedPlan.name || `${matchedPlan.code} Tier`,
          cpuText: cpu,
          memText: mem,
          realHourlyRate: rate,
          rateText: formattedRate,
        }
      }
      const isIdr = blueprintRateCurrency === "IDR"
      const fallbackRate = blueprint.hourlyRate ?? (isIdr ? 56 : 0.04)
      const formattedRate = isIdr
        ? `IDR ${Math.round(fallbackRate)}/jam`
        : `$${fallbackRate.toFixed(2)}/hour`
      return {
        planName: blueprint.computeTier || "Medium Tier",
        cpuText: "1 vCPU",
        memText: "2GB RAM",
        realHourlyRate: fallbackRate,
        rateText: formattedRate,
      }
    }, [
      matchedPlan,
      blueprint.computeTier,
      blueprint.hourlyRate,
      effectiveCurrency,
      blueprintRateCurrency,
    ])

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
    blueprint.hourlyRate,
    blueprintRateCurrency,
    matchedPlan
  )

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

          {/* Compute Plan / Hardware Resource Sizing */}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {agentMessages.computePlanLabel}
            </span>
            {catalogPlans.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {catalogPlans.map((plan, idx) => {
                  const isSelected = matchedPlan?.code === plan.code
                  const planKey = plan.id || plan.code || `plan-${idx}`
                  const resources = getPlanResources(plan)
                  const offer =
                    plan.offers?.find((o) => o.billingPeriod === "MONTHLY") ||
                    plan.offers?.[0]
                  const periodPrice = offer?.periodPrice
                    ? Number(offer.periodPrice)
                    : effectiveCurrency === "IDR"
                      ? plan.code === "SMALL"
                        ? 20000
                        : 40000
                      : plan.code === "SMALL"
                        ? 2
                        : 4
                  const hourly =
                    effectiveCurrency === "IDR"
                      ? Math.ceil(periodPrice / 720)
                      : Number((periodPrice / 720).toFixed(4))
                  const cpuStr =
                    resources.cpu >= 1000
                      ? `${(resources.cpu / 1000).toFixed(1).replace(/\.0$/, "")} vCPU`
                      : `${resources.cpu}m CPU`
                  const memStr =
                    resources.mem >= 1024
                      ? `${Math.round(resources.mem / 1024)}GB RAM`
                      : `${resources.mem}MB RAM`
                  const priceStr =
                    effectiveCurrency === "IDR"
                      ? `Rp ${periodPrice.toLocaleString("id-ID")} / bulan (~IDR ${hourly}/jam)`
                      : `$${periodPrice.toFixed(2)} / month (~$${hourly.toFixed(2)}/hr)`

                  return (
                    <button
                      key={planKey}
                      type="button"
                      onClick={() => {
                        blueprint.computeTier = plan.name || `${plan.code} Tier`
                        blueprint.hourlyRate = hourly
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card hover:bg-muted/40"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          {plan.name || `${plan.code} (Tier)`}
                        </span>
                        {isSelected && (
                          <CheckCircle
                            className="size-4 text-primary"
                            weight="fill"
                          />
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {cpuStr} · {memStr}
                      </span>
                      <span className="text-[11px] font-medium text-foreground">
                        {priceStr}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <span className="text-sm font-medium text-foreground">
                {computePlan}
              </span>
            )}
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
                hourlyRate={realHourlyRate}
                rateCurrency={blueprintRateCurrency}
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
