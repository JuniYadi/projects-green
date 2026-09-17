"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Cpu,
  Globe,
  HardDrives,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  getCatalogProduct,
  type CatalogProductDetailResponse,
} from "@/lib/billing-client"
import { getPlanResources } from "@/modules/deploy/catalog-plan-utils"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { GitSizingConfig } from "./types"

type GitSizingStepProps = {
  initialConfig?: Partial<GitSizingConfig>
  suggestedSubdomain: string
  currency?: string
  onBack: () => void
  onNext: (config: GitSizingConfig) => void
}

const TIERS = [
  {
    id: "starter" as const,
    name: "Starter Tier",
    rate: 0.02,
    cpu: 250,
    memory: 512,
    description: "Best for lightweight APIs, test deployments, and blogs.",
  },
  {
    id: "standard" as const,
    name: "Standard Tier",
    rate: 0.04,
    cpu: 500,
    memory: 1024,
    recommended: true,
    description: "Optimal for production Next.js, Node.js, and SSR web apps.",
  },
  {
    id: "pro" as const,
    name: "Pro High-Capacity",
    rate: 0.08,
    cpu: 1000,
    memory: 2048,
    description:
      "Heavy traffic workloads, queues, and database intensive tasks.",
  },
]

export function GitSizingStep({
  initialConfig,
  suggestedSubdomain,
  currency = "USD",
  onBack,
  onNext,
}: GitSizingStepProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [catalogData, setCatalogData] =
    useState<CatalogProductDetailResponse | null>(null)
  const [tier, setTier] = useState<string>(initialConfig?.tier ?? "standard")
  const [subdomain, setSubdomain] = useState(
    initialConfig?.subdomain ?? suggestedSubdomain
  )

  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      try {
        const res = await getCatalogProduct("APP_HOSTING", currency)
        if (isMounted && res) {
          setCatalogData(res)
          if (!initialConfig?.tier && res.product?.plans?.[0]) {
            const std = res.product.plans.find(
              (p) => p.code === "STANDARD" || p.code === "MEDIUM"
            )
            setTier(
              std?.code.toLowerCase() || res.product.plans[0].code.toLowerCase()
            )
          }
        }
      } catch {
        // Fall back gracefully to static presets
      }
    }
    void loadCatalog()
    return () => {
      isMounted = false
    }
  }, [currency, initialConfig?.tier])

  const catalogPlans = useMemo(() => {
    return catalogData?.product?.plans ?? []
  }, [catalogData])

  const tiers = useMemo(() => {
    if (catalogPlans.length > 0) {
      return catalogPlans.map((plan, index) => {
        const resources = getPlanResources(plan)
        const offer =
          plan.offers?.find((o) => o.billingPeriod === "MONTHLY") ||
          plan.offers?.[0]
        const periodPrice = offer?.periodPrice ? Number(offer.periodPrice) : 0
        const hourlyRate =
          periodPrice > 0 ? Number((periodPrice / 720).toFixed(4)) : 0.04
        return {
          id: plan.code.toLowerCase(),
          code: plan.code,
          name: plan.name || `${plan.code} Tier`,
          rate: hourlyRate,
          monthlyPrice: periodPrice,
          currency: offer?.currency || currency,
          cpu: resources.cpu,
          memory: resources.mem,
          recommended:
            index === 1 || plan.code === "MEDIUM" || plan.code === "STANDARD",
          description:
            plan.description ||
            `Compute plan with ${resources.cpu}m CPU and ${resources.mem}MB RAM.`,
        }
      })
    }
    return TIERS.map((t) => ({
      ...t,
      code: t.id.toUpperCase(),
      monthlyPrice: undefined,
      currency,
    }))
  }, [catalogPlans, currency])

  const selectedTierConfig =
    tiers.find(
      (t) => t.id === tier || t.code.toLowerCase() === tier.toLowerCase()
    ) ??
    tiers[1] ??
    tiers[0]!

  const handleContinue = () => {
    onNext({
      tier: selectedTierConfig.code || tier,
      cpu: selectedTierConfig.cpu,
      memory: selectedTierConfig.memory,
      hourlyRate: selectedTierConfig.rate,
      subdomain: subdomain.trim().toLowerCase(),
      planName: selectedTierConfig.name,
      monthlyPrice: selectedTierConfig.monthlyPrice,
      currency: selectedTierConfig.currency,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Target Region */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">
          {messages.pDeployGitDeployGitSizingStep.deploymentRegionTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.pDeployGitDeployGitSizingStep.deploymentRegionDescription}
        </p>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">
                {messages.pDeployGitDeployGitSizingStep.regionName}
              </p>
              <p className="text-xs text-muted-foreground">
                {messages.pDeployGitDeployGitSizingStep.regionAvailability}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-700"
          >
            {messages.pDeployGitDeployGitSizingStep.regionStatusOnline}
          </Badge>
        </div>
      </div>

      {/* Compute Sizing Presets */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {messages.pDeployGitDeployGitSizingStep.computeSizingTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.pDeployGitDeployGitSizingStep.computeSizingDescription}
            </p>
          </div>
          {catalogPlans.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {messages.pDeployGitDeployGitSizingStep.catalogBadge}
            </Badge>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {tiers.map((item) => {
            const isSelected =
              tier === item.id ||
              tier.toLowerCase() === item.id.toLowerCase() ||
              tier.toLowerCase() === item.code.toLowerCase()
            return (
              <div
                key={item.id}
                onClick={() => setTier(item.id)}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{item.name}</h3>
                    {item.recommended && (
                      <Badge variant="secondary" className="text-[10px]">
                        {
                          messages.pDeployGitDeployGitSizingStep
                            .recommendedBadge
                        }
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    {item.monthlyPrice ? (
                      <div>
                        <span className="text-xl font-bold">
                          {formatBillingMoney(item.monthlyPrice, item.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          /mo (~${item.rate.toFixed(4)}/h)
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">
                          ${item.rate.toFixed(4)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / hour
                        </span>
                      </>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>
                        {item.cpu}
                        {messages.pDeployGitDeployGitSizingStep.vcpuUnit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <HardDrives className="h-3.5 w-3.5" />
                      <span>
                        {item.memory}{" "}
                        {messages.pDeployGitDeployGitSizingStep.ramUnit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                  >
                    {isSelected ? "Selected" : "Select Tier"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Domain & Public Ingress */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">
          {messages.pDeployGitDeployGitSizingStep.domainIngressTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.pDeployGitDeployGitSizingStep.domainIngressDescription}
        </p>

        <div className="mt-4 max-w-lg">
          <label className="text-xs font-medium text-muted-foreground uppercase">
            {messages.pDeployGitDeployGitSizingStep.subdomainPrefixLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              className="font-mono text-sm"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder={
                messages.pDeployGitDeployGitSizingStep.subdomainPlaceholder
              }
            />
            <span className="text-sm font-medium text-muted-foreground">
              .pfnapp.dev
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" />
            {messages.pDeployGitDeployGitSizingStep.httpsConfiguredText}
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {messages.pDeployGitDeployGitSizingStep.backToBuildConfigButton}
        </Button>
        <Button onClick={handleContinue} disabled={!subdomain.trim()}>
          {messages.pDeployGitDeployGitSizingStep.reviewDeploymentButton}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
