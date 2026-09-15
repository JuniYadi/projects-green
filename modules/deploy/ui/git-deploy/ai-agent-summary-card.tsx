"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Code,
  Cpu,
  GitBranch,
  Lightning,
  Plus,
  RocketLaunch,
  Sparkle,
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
import { toast } from "sonner"
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
  userName?: string
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
  userName,
  onStartOver,
  onDeploy,
}: AiAgentSummaryCardProps) {
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  const detection = useMemo(
    () => (inspectionData?.detection ?? {}) as Record<string, unknown>,
    [inspectionData?.detection]
  )
  const plan = useMemo(
    () => (inspectionData?.plan ?? {}) as Record<string, unknown>,
    [inspectionData?.plan]
  )
  const planDetection = (plan?.detection ?? {}) as Record<string, unknown>
  const primaryFramework = detection?.primaryFramework as
    Record<string, unknown> | undefined

  const detectedFrameworkId = (
    (primaryFramework?.id as string) ||
    (planDetection?.framework as string) ||
    (detection.framework as string) ||
    ""
  ).toLowerCase()

  const detectedFrameworkName =
    (primaryFramework?.name as string) ||
    (detectedFrameworkId === "laravel"
      ? "Laravel"
      : detectedFrameworkId === "nextjs"
        ? "Next.js"
        : detectedFrameworkId === "react"
          ? "React"
          : detectedFrameworkId === "django"
            ? "Django"
            : detectedFrameworkId === "fastapi"
              ? "FastAPI"
              : detectedFrameworkId === "express"
                ? "Express"
                : (detection.framework as string) || "Node.js")

  const frameworkVersion =
    (detection.frameworkVersion as string) ||
    (planDetection.version as string) ||
    (detection.version as string) ||
    ""

  const ecosystem = (
    (primaryFramework?.ecosystem as string) ||
    (planDetection.runtime as string) ||
    (detectedFrameworkId === "laravel" ? "php" : "") ||
    (detectedFrameworkId === "django" ? "python" : "") ||
    ""
  ).toLowerCase()

  const requiredDeps =
    (detection.requiredDependencies as Array<{
      id?: string
      name?: string
      version?: string
      kind?: string
    }>) || []
  const runtimeDep = requiredDeps.find((d) => d.kind === "runtime")

  const runtimeName = runtimeDep?.name
    ? `${runtimeDep.name}${runtimeDep.version ? ` ${runtimeDep.version}` : ""}`
    : (detection.primaryEngine as string) ||
      (ecosystem === "php"
        ? "PHP 8.2"
        : ecosystem === "python"
          ? "Python 3.11"
          : ecosystem === "go"
            ? "Go 1.22"
            : ecosystem === "ruby"
              ? "Ruby 3.2"
              : "Node.js 20")

  const packageManager =
    (detection.packageManager as string) ||
    (ecosystem === "php" || detectedFrameworkId === "laravel"
      ? "Composer"
      : ecosystem === "python"
        ? "pip"
        : ecosystem === "go"
          ? "go modules"
          : ecosystem === "ruby"
            ? "Bundler"
            : "pnpm")

  const detectedPort =
    Number(detection.defaultPort) ||
    Number(planDetection.port) ||
    Number(detection.port) ||
    (ecosystem === "php" || detectedFrameworkId === "laravel"
      ? 8000
      : ecosystem === "python"
        ? 8000
        : ecosystem === "go"
          ? 8080
          : 3000)

  const planCommands = (planDetection.commands as string[]) || []
  const defaultBuildCommand =
    planCommands[0] ||
    (detection.buildCommand as string) ||
    (ecosystem === "php" || detectedFrameworkId === "laravel"
      ? "composer install --no-dev --optimize-autoloader"
      : detectedFrameworkId === "django"
        ? "pip install -r requirements.txt && python manage.py collectstatic --noinput"
        : ["fastapi", "flask"].includes(detectedFrameworkId)
          ? "pip install -r requirements.txt"
          : ["gin", "echo"].includes(detectedFrameworkId)
            ? "go build -o server ."
            : "pnpm run build")

  const defaultStartCommand =
    planCommands[1] ||
    (detection.startCommand as string) ||
    (ecosystem === "php" || detectedFrameworkId === "laravel"
      ? "php artisan serve --host=0.0.0.0 --port=8000"
      : detectedFrameworkId === "django"
        ? "python manage.py runserver 0.0.0.0:8000"
        : detectedFrameworkId === "fastapi"
          ? "uvicorn main:app --host 0.0.0.0 --port 8000"
          : detectedFrameworkId === "flask"
            ? "flask run --host=0.0.0.0 --port=8000"
            : ["gin", "echo"].includes(detectedFrameworkId)
              ? "./server"
              : "pnpm start")

  const rawConfidence =
    typeof detection.confidence === "number"
      ? detection.confidence
      : typeof planDetection.confidence === "number"
        ? planDetection.confidence
        : 0.98
  const confidencePercentage = Math.round(
    rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence
  )

  // Step 1: Branch & Monorepo / App Directory
  const [branch, setBranch] = useState(
    ((inspectionData?.source as Record<string, unknown> | undefined)?.ref as
      string | undefined) ||
      (detection.branch as string) ||
      source.branch ||
      "main"
  )
  const [rootDir, setRootDir] = useState(
    ((inspectionData?.source as Record<string, unknown> | undefined)?.subdir as
      string | undefined) ||
      (detection.outputDir as string) ||
      source.rootDir ||
      "./"
  )

  // Step 2: Detected Stack & Runtime
  const frameworkName = detectedFrameworkName
  const [port, setPort] = useState<number>(detectedPort)
  const [buildCommand, setBuildCommand] = useState(defaultBuildCommand)
  const [startCommand, setStartCommand] = useState(defaultStartCommand)

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

  // Step 4: Environment Variables (Auto-prefilled from .env.example or smart template)
  const computePrefilledEnvVars = useCallback((): EnvVar[] => {
    const isPhp =
      detectedFrameworkId === "laravel" ||
      ecosystem === "php" ||
      frameworkName.toLowerCase() === "laravel"
    const isPython =
      ["django", "fastapi", "flask"].includes(detectedFrameworkId) ||
      ecosystem === "python"

    // 1. If inspectionData has envRequirements or envDefaults from .env.example
    const envReqs = (
      plan?.configuration as {
        envRequirements?: Array<{ key: string; value?: string }>
      }
    )?.envRequirements
    if (Array.isArray(envReqs) && envReqs.length > 0) {
      return envReqs.map((e) => ({
        key: e.key,
        value:
          e.key === "APP_URL"
            ? `https://${initialSubdomain}.pfnapp.dev`
            : e.key === "APP_ENV"
              ? "production"
              : e.key === "APP_DEBUG"
                ? "false"
                : e.value || "",
      }))
    }

    const envDefaults =
      (detection?.envDefaults as Record<string, string> | undefined) || {}
    const defaultEntries = Object.entries(envDefaults)
    if (defaultEntries.length > 0) {
      return defaultEntries.map(([k, v]) => ({
        key: k,
        value:
          k === "APP_URL"
            ? `https://${initialSubdomain}.pfnapp.dev`
            : k === "APP_ENV"
              ? "production"
              : k === "APP_DEBUG"
                ? "false"
                : v || "",
      }))
    }

    // 2. Framework fallback prefill
    if (isPhp) {
      return [
        { key: "APP_NAME", value: initialSubdomain || "Laravel" },
        { key: "APP_ENV", value: "production" },
        { key: "APP_KEY", value: "" },
        { key: "APP_DEBUG", value: "false" },
        { key: "APP_URL", value: `https://${initialSubdomain}.pfnapp.dev` },
        { key: "DB_CONNECTION", value: "mysql" },
        { key: "DB_HOST", value: "127.0.0.1" },
        { key: "DB_PORT", value: "3306" },
        { key: "DB_DATABASE", value: initialSubdomain || "laravel" },
        { key: "DB_USERNAME", value: "root" },
        { key: "DB_PASSWORD", value: "" },
      ]
    }
    if (isPython) {
      return [
        { key: "SECRET_KEY", value: "" },
        { key: "DEBUG", value: "0" },
        { key: "ALLOWED_HOSTS", value: `${initialSubdomain}.pfnapp.dev` },
        { key: "DATABASE_URL", value: "" },
      ]
    }
    return [
      { key: "NODE_ENV", value: "production" },
      { key: "PORT", value: String(detectedPort || 3000) },
      {
        key: "NEXT_PUBLIC_APP_URL",
        value: `https://${initialSubdomain}.pfnapp.dev`,
      },
    ]
  }, [
    detectedFrameworkId,
    ecosystem,
    frameworkName,
    initialSubdomain,
    plan,
    detection,
    detectedPort,
  ])

  const [envVars, setEnvVars] = useState<EnvVar[]>(() =>
    computePrefilledEnvVars()
  )
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")

  const handleUpdateEnvVar = (idx: number, val: string) => {
    setEnvVars((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, value: val } : item))
    )
  }

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

  const repoName = useMemo(() => {
    try {
      const parts = source.url.replace(/\.git$/i, "").split("/")
      return parts.slice(-2).join("/") || parts[parts.length - 1] || source.url
    } catch {
      return source.url
    }
  }, [source.url])

  const handlePrefillEnvKeys = () => {
    const templateKeys = computePrefilledEnvVars()
    setEnvVars((prev) => {
      const existingKeys = new Set(prev.map((e) => e.key))
      const added = templateKeys.filter((t) => !existingKeys.has(t.key))
      return [...prev, ...added]
    })
    toast.success(agentMessages.prefillSuccess)
  }

  const insightEntrypoint = useMemo(() => {
    const versionLabel = frameworkVersion ? ` ${frameworkVersion}` : ""
    if (detectedFrameworkId === "laravel" || ecosystem === "php") {
      return lang === "id"
        ? `Terverifikasi aplikasi Laravel${versionLabel} melalui file composer.json dan entrypoint artisan.`
        : `Verified Laravel${versionLabel} application with composer.json dependencies and artisan entrypoint.`
    }
    if (detectedFrameworkId === "django" || ecosystem === "python") {
      return lang === "id"
        ? `Terverifikasi aplikasi Python${versionLabel} melalui requirements dan entrypoint WSGI/ASGI.`
        : `Verified Python${versionLabel} application with requirements and WSGI/ASGI entrypoint.`
    }
    return lang === "id"
      ? `Terverifikasi stack ${frameworkName}${versionLabel} dengan konfigurasi siap-pakai.`
      : `Verified ${frameworkName}${versionLabel} stack with production-ready defaults.`
  }, [detectedFrameworkId, ecosystem, frameworkName, frameworkVersion, lang])

  const insightCompute = useMemo(() => {
    if (detectedFrameworkId === "laravel" || ecosystem === "php") {
      return lang === "id"
        ? "Disarankan ukuran Medium (2GB RAM) agar worker PHP-FPM dan cache Composer stabil."
        : "Recommended Medium compute (2GB RAM) for smooth PHP-FPM workers and Composer caching."
    }
    return lang === "id"
      ? "Disarankan ukuran Standard / Medium untuk isolasi container dan build yang optimal."
      : "Recommended Standard compute (1024MB RAM) for optimal container execution and build isolation."
  }, [detectedFrameworkId, ecosystem, lang])

  const insightEnv = useMemo(() => {
    return lang === "id"
      ? "Variabel lingkungan dari .env.example telah diisi otomatis. Anda dapat menyesuaikan nilainya di bawah."
      : "Environment variables from .env.example have been auto-configured. You can customize any values below."
  }, [lang])

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

      {/* AI Deployment Copilot Card (Persistent Persona & Blueprint Overview) */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-b from-primary/5 via-card to-card p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <Sparkle className="h-6 w-6" weight="fill" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground sm:text-lg">
                  {agentMessages.copilotTitle}
                </h2>
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-xs font-medium text-primary"
                >
                  {agentMessages.blueprintReady} ({confidencePercentage}%{" "}
                  {agentMessages.confidence})
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {agentMessages.copilotGreeting
                  .replace("{name}", userName || "Developer")
                  .replace("{repo}", repoName)
                  .replace("{branch}", branch)}
              </p>
            </div>
          </div>
        </div>

        {/* Verified Stack Summary */}
        <div className="mt-3.5 border-t border-border/50 pt-2.5">
          <p className="font-mono text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {agentMessages.verifiedStack}:
            </span>{" "}
            {frameworkName}
            {frameworkVersion ? ` ${frameworkVersion}` : ""} · {runtimeName} ·{" "}
            {packageManager} · Port {port}
          </p>
        </div>

        {/* AI Proactive Insights Box */}
        <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs text-muted-foreground">
          <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
            <Sparkle className="h-3.5 w-3.5 text-primary" weight="bold" />
            <span>{agentMessages.proactiveInsights}</span>
          </div>
          <ul className="list-inside list-disc space-y-1">
            <li>{insightEntrypoint}</li>
            <li>{insightCompute}</li>
            <li>{insightEnv}</li>
          </ul>
        </div>
      </div>

      {/* Grid Layout: Left Column (Source & Build) and Right Column (Compute & Sizing) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Card 1: Source & Monorepo Controls */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {agentMessages.repoScopeHeading}
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
                  {frameworkName}
                  {frameworkVersion ? ` ${frameworkVersion}` : ""}
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
              {agentMessages.blueprintHeading}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {agentMessages.envHeading}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {envVars.length === 0
                    ? agentMessages.noEnvVars
                    : `${envVars.length} variable${envVars.length === 1 ? "" : "s"} configured`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrefillEnvKeys}
                  className="h-8 gap-1 text-xs"
                >
                  <Lightning
                    className="h-3.5 w-3.5 text-primary"
                    weight="fill"
                  />
                  <span>{agentMessages.prefillEnvKeys}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDialogOpen(true)}
                  className="h-8 gap-1 text-xs"
                >
                  <span>{agentMessages.bulkPaste}</span>
                </Button>
              </div>
            </div>

            {/* Variable Rows */}
            {envVars.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {envVars.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-1.5 px-2.5 text-xs"
                  >
                    <span className="w-1/3 min-w-[120px] truncate font-mono font-medium text-foreground">
                      {item.key}
                    </span>
                    <span className="text-muted-foreground">=</span>
                    <Input
                      value={item.value}
                      onChange={(e) => handleUpdateEnvVar(idx, e.target.value)}
                      placeholder="Value"
                      className="h-7 flex-1 bg-background/50 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEnvVar(idx)}
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
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
                {agentMessages.sizingHeading}
              </span>
              {catalogPlans.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {agentMessages.catalogBadge}
                </Badge>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2.5">
              {tiers.map((t) => {
                const isSelected = selectedTier.code === t.code
                return (
                  <div
                    key={t.code}
                    onClick={() => setTier(t.code)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                        : "border-border bg-background hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {t.name}
                        </span>
                        {t.recommended && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-[10px] text-primary"
                          >
                            {agentMessages.recommendedBadge}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.cpu >= 1000
                          ? `${(t.cpu / 1000).toFixed(t.cpu % 1000 === 0 ? 0 : 1)} vCPU`
                          : `${(t.cpu / 1000).toFixed(1)} vCPU (${t.cpu}m)`}{" "}
                        · {t.memory}MB RAM
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">
                        {t.currency === "IDR"
                          ? `Rp ${t.monthlyPrice.toLocaleString("id-ID")}`
                          : `$${t.monthlyPrice}`}
                      </span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card 6: Subdomain & Ingress */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {agentMessages.subdomainLabel}
            </span>
            <div className="mt-2 flex items-center gap-1 font-mono text-sm">
              <Input
                value={subdomain}
                onChange={(e) =>
                  setSubdomain(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                placeholder="my-app"
                className="h-9 font-mono text-sm"
              />
              <span className="text-xs text-muted-foreground">.pfnapp.dev</span>
            </div>
          </div>

          {/* Card 7: Balance Verification Card & Deploy CTA */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {agentMessages.accountBalance}
              </span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>

            {accountStatus === "loading" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="h-3.5 w-3.5 animate-spin" />
                <span>Checking balance…</span>
              </div>
            )}

            {accountStatus === "loaded" && account && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={isBalanceSufficient ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {isBalanceSufficient
                      ? agentMessages.balanceVerified
                      : agentMessages.insufficientBalance}
                  </Badge>
                </div>
                <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                  {account.formattedBalance ||
                    `${currency} ${account.balanceIdr || "0"}`}{" "}
                  available
                </p>
                {!isBalanceSufficient && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                    <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{agentMessages.balanceBelowCost}</p>
                      <Button
                        size="sm"
                        variant="link"
                        onClick={() => setTopUpOpen(true)}
                        className="h-auto p-0 text-xs font-semibold text-amber-700 underline dark:text-amber-300"
                      >
                        {agentMessages.topUp} &rarr;
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {accountStatus === "error" && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{agentMessages.balanceUnknown}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTopUpOpen(true)}
                  className="h-7 text-xs"
                >
                  {agentMessages.topUp}
                </Button>
              </div>
            )}

            {/* Deploy Trigger CTA */}
            <Button
              size="lg"
              onClick={handleTriggerDeploy}
              disabled={deploying || !subdomain.trim()}
              className="mt-2 w-full gap-2 font-semibold shadow-xs"
            >
              {deploying ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin" />
                  <span>Initiating deployment…</span>
                </>
              ) : (
                <>
                  <RocketLaunch className="h-4 w-4" weight="fill" />
                  <span>{agentMessages.deployButton}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Paste Environment Variables Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{agentMessages.bulkPasteTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {agentMessages.bulkPasteDesc}
          </p>
          <Textarea
            rows={8}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`DB_HOST=127.0.0.1\nDB_PORT=5432\nAPI_KEY=secret_123`}
            className="font-mono text-xs"
          />
          <DialogFooter className="gap-2 sm:gap-0">
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
        onSuccess={reloadAccount}
      />
    </div>
  )
}
