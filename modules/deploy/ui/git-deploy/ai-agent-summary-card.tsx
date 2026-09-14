"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Code,
  Cpu,
  GitBranch,
  Globe,
  Plus,
  RocketLaunch,
  Spinner,
  Trash,
  Wallet,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  getCatalogProduct,
  getAccount,
  type CatalogProductDetailResponse,
  type BillingAccount,
} from "@/lib/billing-client"
import { getPlanResources } from "@/modules/deploy/catalog-plan-utils"
import { QuickTopUpDialog } from "@/components/billing/quick-top-up-dialog"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import type { GitSourceConfig } from "./types"

type EnvVar = {
  key: string
  value: string
}

export type DeploymentSummaryConfig = {
  branch: string
  rootDir: string
  port: number
  buildCommand: string
  startCommand: string
  envVars: Record<string, string>
  tier: string
  cpu: number
  memory: number
  subdomain: string
  hourlyRate: number
  monthlyPrice?: number
}

type AiAgentSummaryCardProps = {
  source: GitSourceConfig
  inspectionData?: Record<string, unknown> | null
  currency?: "USD" | "IDR"
  lang?: string
  onStartOver: () => void
  onDeploy: (config: DeploymentSummaryConfig) => Promise<void>
}

const DEFAULT_TIERS = [
  {
    id: "starter",
    code: "SMALL",
    name: "Starter Compute",
    rate: 0.02,
    cpu: 250,
    memory: 512,
    monthlyPrice: 15,
    description: "Best for lightweight APIs, test deployments, and blogs.",
  },
  {
    id: "standard",
    code: "MEDIUM",
    name: "Standard Compute",
    rate: 0.04,
    cpu: 500,
    memory: 1024,
    monthlyPrice: 30,
    recommended: true,
    description: "Optimal for production Next.js, Node.js, and SSR web apps.",
  },
  {
    id: "pro",
    code: "LARGE",
    name: "Pro High-Capacity",
    rate: 0.08,
    cpu: 1000,
    memory: 2048,
    monthlyPrice: 60,
    description: "Heavy traffic workloads, queues, and intensive tasks.",
  },
]

export function AiAgentSummaryCard({
  source,
  inspectionData,
  currency = "USD",
  lang = "en",
  onStartOver,
  onDeploy,
}: AiAgentSummaryCardProps) {
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  const detected = (inspectionData?.detection ?? {}) as Record<string, unknown>

  // Step 1: Branch & Monorepo / App Directory
  const [branch, setBranch] = useState(
    (detected.branch as string) || source.branch || "main"
  )
  const [rootDir, setRootDir] = useState(
    (detected.outputDir as string) || source.rootDir || "./"
  )

  // Step 2: Detected Stack & Runtime
  const frameworkName = (detected.framework as string) || "Node.js"
  const frameworkVersion = (detected.version as string) || ""
  const runtimeName = (detected.primaryEngine as string) || "Node.js 20"
  const packageManager = (detected.packageManager as string) || "pnpm"

  // Step 3: Build & Network Overrides
  const [port, setPort] = useState<number>(Number(detected.port) || 3000)
  const [buildCommand, setBuildCommand] = useState(
    (detected.buildCommand as string) || "pnpm run build"
  )
  const [startCommand, setStartCommand] = useState(
    (detected.startCommand as string) || "pnpm start"
  )

  // Step 4: Environment Variables
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")

  const handleAddEnvVar = () => {
    const trimmedKey = newKey.trim()
    if (!trimmedKey) return
    setEnvVars((prev) => [...prev, { key: trimmedKey, value: newValue }])
    setNewKey("")
    setNewValue("")
  }

  const handleRemoveEnvVar = (idx: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleBulkParse = () => {
    const lines = bulkText.split("\n")
    const parsed: EnvVar[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim()
        let v = trimmed.slice(eqIdx + 1).trim()
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1)
        }
        if (k) parsed.push({ key: k, value: v })
      }
    }
    setEnvVars((prev) => [...prev, ...parsed])
    setBulkText("")
    setBulkDialogOpen(false)
  }

  // Step 5: Compute Sizing & Product Catalog
  const [catalogData, setCatalogData] =
    useState<CatalogProductDetailResponse | null>(null)
  const [tier, setTier] = useState<string>("MEDIUM")

  // Generate suggested subdomain from repo URL
  const initialSubdomain = useMemo(() => {
    try {
      const parts = source.url.replace(/\.git$/i, "").split("/")
      const repo = parts[parts.length - 1] || "my-app"
      return repo
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
    } catch {
      return "my-app"
    }
  }, [source.url])

  const [subdomain, setSubdomain] = useState(initialSubdomain)

  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      try {
        const res = await getCatalogProduct("APP_HOSTING", currency)
        if (isMounted && res) {
          setCatalogData(res)
          const std = res.product?.plans?.find(
            (p) => p.code === "MEDIUM" || p.code === "STANDARD"
          )
          if (std) setTier(std.code)
        }
      } catch {
        // use fallback presets
      }
    }
    void loadCatalog()
    return () => {
      isMounted = false
    }
  }, [currency])

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
    return DEFAULT_TIERS.map((t) => ({
      ...t,
      currency,
    }))
  }, [catalogPlans, currency])

  const selectedTier =
    tiers.find(
      (t) =>
        t.code === tier ||
        t.id === tier.toLowerCase() ||
        t.code.toLowerCase() === tier.toLowerCase()
    ) ??
    tiers[1] ??
    tiers[0]!

  // Balance Check & Top-Up
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [accountStatus, setAccountStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading")
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)

  const reloadAccount = async () => {
    try {
      const res = await getAccount()
      if (res?.ok) {
        setAccount(res)
        setAccountStatus("loaded")
      } else {
        setAccountStatus("error")
      }
    } catch {
      setAccountStatus("error")
    }
  }

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await getAccount()
        if (active) {
          if (res?.ok) {
            setAccount(res)
            setAccountStatus("loaded")
          } else {
            setAccountStatus("error")
          }
        }
      } catch {
        if (active) setAccountStatus("error")
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const isBalanceSufficient =
    accountStatus === "loaded" ? Boolean(account?.isPositive) : false

  const handleTriggerDeploy = async () => {
    setDeploying(true)
    try {
      const envObj: Record<string, string> = {}
      for (const item of envVars) {
        if (item.key) envObj[item.key] = item.value
      }

      await onDeploy({
        branch: branch.trim() || "main",
        rootDir: rootDir.trim() || "./",
        port,
        buildCommand: buildCommand.trim(),
        startCommand: startCommand.trim(),
        envVars: envObj,
        tier: selectedTier.code,
        cpu: selectedTier.cpu,
        memory: selectedTier.memory,
        subdomain: subdomain.trim().toLowerCase(),
        hourlyRate: selectedTier.rate,
        monthlyPrice: selectedTier.monthlyPrice,
      })
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Heading & Start Over */}
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {agentMessages.summaryHeading}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {agentMessages.summarySubheading}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onStartOver}
          className="w-fit gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{agentMessages.startOver}</span>
        </Button>
      </div>

      {/* Grid Layout: Left Column (Source & Build) and Right Column (Compute & Sizing) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Card 1: Source & Monorepo Controls */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {agentMessages.sourceRepo}
              </span>
              <Badge variant="secondary" className="text-xs">
                {source.isPrivate
                  ? agentMessages.privateBadge
                  : agentMessages.publicBadge}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-sm font-medium text-foreground">
              {source.url}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {agentMessages.branchLabel}
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="h-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {agentMessages.directoryLabel}
                </label>
                <Input
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  placeholder="./"
                  className="mt-1 h-9 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Detected Framework & Runtime */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {agentMessages.frameworkLabel}
            </span>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium">
                <Code className="h-4 w-4 text-primary" />
                <span>
                  {frameworkName} {frameworkVersion}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span>{runtimeName}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span>{packageManager}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Build & Network Settings */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {agentMessages.buildSettings}
            </span>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {agentMessages.buildCommandLabel}
                </label>
                <Input
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  placeholder="pnpm run build"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {agentMessages.startCommandLabel}
                  </label>
                  <Input
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder="pnpm start"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {agentMessages.portLabel}
                  </label>
                  <Input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value) || 3000)}
                    placeholder="3000"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Environment Variables Manager */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {agentMessages.envVarsLabel}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {envVars.length === 0
                    ? agentMessages.noEnvVars
                    : `${envVars.length} variable${envVars.length === 1 ? "" : "s"} configured`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDialogOpen(true)}
                className="h-8 gap-1 text-xs"
              >
                <span>{agentMessages.bulkPaste}</span>
              </Button>
            </div>

            {/* Variable Rows */}
            {envVars.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {envVars.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2 text-xs"
                  >
                    <span className="w-1/3 truncate font-mono font-medium text-foreground">
                      {item.key}
                    </span>
                    <span className="text-muted-foreground">=</span>
                    <span className="flex-1 truncate font-mono text-muted-foreground">
                      ••••••••
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEnvVar(idx)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add single variable inline */}
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="VARIABLE_NAME"
                className="h-8 font-mono text-xs uppercase"
              />
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="h-8 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!newKey.trim()}
                onClick={handleAddEnvVar}
                className="h-8 shrink-0 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{agentMessages.addVariable}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Sizing, Domain, Balance Gate, CTA */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Card 5: Compute Sizing */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {agentMessages.computeSizingLabel}
              </span>
              {catalogPlans.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {agentMessages.catalogBadge}
                </Badge>
              )}
            </div>

            <div className="mt-3 grid gap-2.5">
              {tiers.map((item) => {
                const isSelected =
                  item.code === selectedTier.code || item.id === selectedTier.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setTier(item.code || item.id.toUpperCase())}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {item.name}
                        </span>
                        {item.recommended && (
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {agentMessages.recommendedBadge}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.cpu}m CPU · {item.memory}MB RAM
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">
                        {currency === "IDR"
                          ? `Rp ${(item.monthlyPrice ?? 0).toLocaleString("id-ID")}`
                          : `$${(item.monthlyPrice ?? 0).toFixed(2)}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        /mo
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card 6: Subdomain & Networking */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {agentMessages.subdomainLabel}
            </span>
            <div className="mt-2 flex items-center rounded-lg border border-border bg-muted/20 px-3 py-2">
              <Globe className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={subdomain}
                onChange={(e) =>
                  setSubdomain(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                className="w-full bg-transparent font-mono text-sm font-medium focus:outline-none"
              />
              <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                .pfnapp.dev
              </span>
            </div>
          </div>

          {/* Card 7: Balance Verification & Final CTA */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  {agentMessages.accountBalance}
                </span>
              </div>
              {accountStatus === "loading" && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Spinner className="h-3 w-3 animate-spin" />
                  <span>...</span>
                </div>
              )}
              {accountStatus === "loaded" && account && (
                <div className="text-right">
                  <Badge
                    variant={isBalanceSufficient ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {isBalanceSufficient
                      ? agentMessages.balanceVerified
                      : agentMessages.insufficientBalance}
                  </Badge>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {account.formattedBalance} available
                  </p>
                </div>
              )}
              {accountStatus === "error" && (
                <Badge
                  variant="outline"
                  className="text-xs text-muted-foreground"
                >
                  {agentMessages.balanceUnknown}
                </Badge>
              )}
            </div>

            {accountStatus === "loaded" && !isBalanceSufficient && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                <div className="flex items-center gap-1.5">
                  <WarningCircle className="h-4 w-4 shrink-0" />
                  <span>{agentMessages.balanceBelowCost}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTopUpOpen(true)}
                  className="h-7 border-amber-500/30 text-xs"
                >
                  {agentMessages.topUp}
                </Button>
              </div>
            )}

            {/* Deploy CTA */}
            <Button
              size="lg"
              disabled={deploying || !subdomain.trim()}
              onClick={handleTriggerDeploy}
              className="h-12 w-full gap-2 text-base font-semibold shadow-md"
            >
              {deploying ? (
                <Spinner className="h-5 w-5 animate-spin" />
              ) : (
                <RocketLaunch className="h-5 w-5" weight="fill" />
              )}
              <span>{agentMessages.deployButton}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Paste Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{agentMessages.bulkPasteTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="mb-2 text-xs text-muted-foreground">
              {agentMessages.bulkPasteDesc}
            </p>
            <Textarea
              rows={8}
              placeholder="DATABASE_URL=postgres://...&#10;API_KEY=xyz..."
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(false)}
            >
              {agentMessages.bulkPasteCancel}
            </Button>
            <Button size="sm" onClick={handleBulkParse}>
              {agentMessages.bulkPasteAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Top-Up Dialog */}
      <QuickTopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        currency={currency}
        onSuccess={() => void reloadAccount()}
      />
    </div>
  )
}
