"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  Cpu,
  Database,
  Eye,
  EyeSlash,
  HardDrive,
  Lightning,
  Lock,
  Plus,
  RocketLaunchIcon,
  ShieldCheckIcon,
  Trash,
  WarningIcon,
} from "@/components/ui/phosphor-icons"
import { TemplateLogo } from "@/app/[lang]/console/app/marketplace/_components/template-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getCatalogProduct,
  type CatalogPlan,
  type CatalogProductDetailResponse,
  getAccount,
  type BillingAccount,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import {
  getPlanResources,
  getTemplateRequiredStorageGb,
} from "@/modules/deploy/catalog-plan-utils"
import { QuickTopUpDialog } from "@/components/billing/quick-top-up-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { AppTemplateBlueprintEnvVar } from "@/modules/deploy/blueprint/app-template-blueprint.schema"
import { buildInitialEnvVars } from "@/modules/deploy/blueprint/app-template-blueprint.service"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { OFFICIAL_APP_TEMPLATES } from "@/modules/deploy/app-template.seed"
import { generateSuggestedAppName } from "@/modules/deploy/app-name-generator"
import { eden } from "@/lib/eden"
import type { MarketplaceTemplateItem } from "@/app/[lang]/console/app/marketplace/_components/template-card"

export interface TemplateDeployViewProps {
  templateSlug: string
  lang?: string
}

function resolveInitialTemplate(
  templateSlug: string
): MarketplaceTemplateItem | null {
  const official = OFFICIAL_APP_TEMPLATES.find(
    (t) =>
      t.slug.toLowerCase() === templateSlug.toLowerCase() ||
      t.slug.toLowerCase().replace(/_/g, "-") ===
        templateSlug.toLowerCase().replace(/_/g, "-")
  )
  if (official) {
    return {
      id: official.slug,
      slug: official.slug,
      name: official.name,
      tagline: official.tagline,
      description: official.description,
      iconUrl: official.iconUrl,
      category: official.category,
      isOfficial: official.isOfficial,
      isFeatured: official.isFeatured,
      installCount: official.installCount,
      blueprint: official.blueprint,
    }
  }
  return null
}

let customEnvCounter = 0
function generateCustomEnvId(): string {
  customEnvCounter += 1
  return `custom_env_${customEnvCounter}`
}

export function TemplateDeployView({
  templateSlug,
  lang = "en",
}: TemplateDeployViewProps) {
  const router = useRouter()
  const messages =
    getMessagesForMaybeLocale(lang).console.app.marketplace.launchDrawer
  const [template, setTemplate] = useState<MarketplaceTemplateItem | null>(() =>
    resolveInitialTemplate(templateSlug)
  )
  const [isTemplateLoading, setIsTemplateLoading] = useState(
    () => !resolveInitialTemplate(templateSlug)
  )
  const [accountData, setAccountData] = useState<BillingAccount | null>(null)
  const [quickTopUpOpen, setQuickTopUpOpen] = useState(false)
  const [appNameOverride, setAppNameOverride] = useState<string | null>(null)
  const [catalogData, setCatalogData] =
    useState<CatalogProductDetailResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("SMALL")
  const [selectedRegionCodeOverride, setSelectedRegionCodeOverride] = useState<
    string | null
  >(null)
  const [cpuOverride, setCpuOverride] = useState<number | null>(null)
  const [memoryOverride, setMemoryOverride] = useState<number | null>(null)
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({})
  const [customEnvVars, setCustomEnvVars] = useState<
    Array<{ id: string; key: string; value: string }>
  >([])
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, boolean>
  >({})
  const [accountRefreshKey, setAccountRefreshKey] = useState(0)
  const [isDeploying, setIsDeploying] = useState(false)

  // Fetch template data if not official seed
  useEffect(() => {
    const existing = resolveInitialTemplate(templateSlug)
    if (existing) {
      return
    }

    let active = true
    void (async () => {
      try {
        const res = await fetch(
          `/api/templates/${encodeURIComponent(templateSlug)}`
        )
        if (res.ok) {
          const data = await res.json()
          if (active && data && !data.error) {
            setTemplate({
              id: data.slug || data.id,
              slug: data.slug,
              name: data.name,
              tagline: data.tagline,
              description: data.description,
              iconUrl: data.iconUrl,
              category: data.category,
              isOfficial: data.isOfficial,
              isFeatured: data.isFeatured,
              installCount: data.installCount,
              blueprint: data.blueprintJson,
            })
          }
        }
      } catch {
        // template not found
      } finally {
        if (active) setIsTemplateLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [templateSlug])

  // Fetch account balance
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const acc = await getAccount()
        if (active && acc?.ok) {
          setAccountData(acc)
        }
      } catch {
        // Ignore transient account error
      }
    })()
    return () => {
      active = false
    }
  }, [accountRefreshKey])

  const fetchAccount = () => setAccountRefreshKey((k) => k + 1)
  const currency: "USD" | "IDR" =
    accountData?.currency === "IDR" || lang === "id" ? "IDR" : "USD"
  const currentBalance = accountData ? Number(accountData.balanceIdr) : 0
  const requiredStorage = useMemo(() => {
    return getTemplateRequiredStorageGb(template?.blueprint)
  }, [template?.blueprint])

  // Fetch catalog products
  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      setCatalogLoading(true)
      try {
        const res = await getCatalogProduct("APP_HOSTING", currency)
        if (isMounted && res) {
          setCatalogData(res)
          const validPlan =
            res.product?.plans?.find((p) => {
              const resLimits = getPlanResources(p)
              return (
                requiredStorage <= 0 || resLimits.storage >= requiredStorage
              )
            }) ?? res.product?.plans?.[0]
          if (validPlan) {
            setSelectedPlanCode(validPlan.code)
            const defaults = getPlanResources(validPlan)
            setCpuOverride(defaults.cpu)
            setMemoryOverride(defaults.mem)
          }
        }
      } catch (err) {
        console.error("Failed to load catalog product for App Hosting", err)
      } finally {
        if (isMounted) setCatalogLoading(false)
      }
    }
    void loadCatalog()
    return () => {
      isMounted = false
    }
  }, [currency, requiredStorage])

  const plans = useMemo(() => {
    return catalogData?.product?.plans ?? []
  }, [catalogData])

  const availableRegions = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; flag: string; id: string }
    >()
    for (const plan of plans) {
      for (const offer of plan.offers || []) {
        if (offer.regionCode) {
          map.set(offer.regionCode, {
            code: offer.regionCode,
            name: offer.regionName || offer.regionCode,
            flag: offer.regionFlag || "🌐",
            id: offer.regionId || offer.regionCode,
          })
        }
      }
    }
    if (map.size === 0) {
      map.set("SINGAPORE", {
        code: "SINGAPORE",
        name: "Singapore",
        flag: "🇸🇬",
        id: "singapore",
      })
    }
    return Array.from(map.values())
  }, [plans])

  const selectedRegion = useMemo(() => {
    if (selectedRegionCodeOverride) {
      return (
        availableRegions.find((r) => r.code === selectedRegionCodeOverride) ||
        availableRegions[0]
      )
    }
    return availableRegions[0]
  }, [availableRegions, selectedRegionCodeOverride])

  const selectedPlan: CatalogPlan | undefined = useMemo(() => {
    return (
      plans.find((p) => p.code === selectedPlanCode) ||
      plans.find((p) => p.code.includes("SMALL")) ||
      plans[0]
    )
  }, [plans, selectedPlanCode])

  const selectedOffer = useMemo(() => {
    if (!selectedPlan?.offers) return undefined
    return (
      selectedPlan.offers.find(
        (o) =>
          o.regionCode === selectedRegion?.code ||
          o.regionId === selectedRegion?.id
      ) ||
      selectedPlan.offers.find((o) => o.billingPeriod === "MONTHLY") ||
      selectedPlan.offers[0]
    )
  }, [selectedPlan, selectedRegion])

  const planStorageGb = useMemo(() => {
    if (!selectedPlan) return 0
    return getPlanResources(selectedPlan).storage
  }, [selectedPlan])

  const hasStorageConflict = useMemo(() => {
    if (requiredStorage <= 0) return false
    return planStorageGb < requiredStorage
  }, [planStorageGb, requiredStorage])

  const effectiveMonthlyPrice = useMemo(() => {
    if (selectedOffer?.periodPrice) {
      return Number.parseFloat(selectedOffer.periodPrice)
    }
    return currency === "IDR" ? 25000 : 2
  }, [selectedOffer, currency])

  const effectiveHourlyRate = useMemo(() => {
    if (effectiveMonthlyPrice <= 0) return 0
    return currency === "IDR"
      ? Math.ceil(effectiveMonthlyPrice / 720)
      : Number((effectiveMonthlyPrice / 720).toFixed(4))
  }, [effectiveMonthlyPrice, currency])

  const hasInsufficientBalance = useMemo(() => {
    if (effectiveMonthlyPrice <= 0) return false
    return currentBalance < effectiveMonthlyPrice
  }, [currentBalance, effectiveMonthlyPrice])

  const balanceDeficit = useMemo(() => {
    return Math.max(0, effectiveMonthlyPrice - currentBalance)
  }, [effectiveMonthlyPrice, currentBalance])

  const autoAppName = useMemo(() => {
    return template ? generateSuggestedAppName(template.slug) : "app"
  }, [template])

  const appName = appNameOverride ?? autoAppName
  const subdomain = `${appName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}.pfnapp.com`

  const defaultEnvValues = useMemo(() => {
    const bp = template?.blueprint
    if (!bp) return {}
    return buildInitialEnvVars(bp, envOverrides)
  }, [template, envOverrides])

  // Compute raw .env text representation
  const rawEnvText = useMemo(() => {
    if (!template?.blueprint) return ""
    const lines: string[] = []
    const schema = template.blueprint.envSchema ?? []
    for (const field of schema) {
      if (field.isHidden) continue
      const val = envOverrides[field.key] ?? defaultEnvValues[field.key] ?? ""
      lines.push(`${field.key}=${val}`)
    }
    for (const c of customEnvVars) {
      if (c.key.trim()) {
        lines.push(`${c.key.trim()}=${c.value}`)
      }
    }
    return lines.join("\n")
  }, [template, defaultEnvValues, envOverrides, customEnvVars])

  const [rawEnvInput, setRawEnvInput] = useState<string | null>(null)
  const currentRawEnv = rawEnvInput ?? rawEnvText

  const handleApplyRawEnv = () => {
    const lines = currentRawEnv.split("\n")
    const newOverrides: Record<string, string> = { ...envOverrides }
    const newCustoms: Array<{ id: string; key: string; value: string }> = []
    const schemaKeys = new Set(
      (template?.blueprint?.envSchema ?? []).map((s) => s.key)
    )

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue
      const eqIdx = line.indexOf("=")
      if (eqIdx <= 0) continue
      const key = line.slice(0, eqIdx).trim()
      let val = line.slice(eqIdx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }

      if (schemaKeys.has(key)) {
        newOverrides[key] = val
      } else {
        newCustoms.push({
          id: generateCustomEnvId(),
          key,
          value: val,
        })
      }
    }

    setEnvOverrides(newOverrides)
    setCustomEnvVars(newCustoms)
    setRawEnvInput(null)
    toast.success(messages.applyEnv || "Environment variables updated!")
  }

  const handleEnvChange = (key: string, value: string) => {
    setEnvOverrides((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const toggleSecretReveal = (key: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleAddCustomEnvVar = () => {
    setCustomEnvVars((prev) => [
      ...prev,
      {
        id: generateCustomEnvId(),
        key: "",
        value: "",
      },
    ])
  }

  const handleRemoveCustomEnvVar = (id: string) => {
    setCustomEnvVars((prev) => prev.filter((v) => v.id !== id))
  }

  const handleCustomEnvVarChange = (
    id: string,
    field: "key" | "value",
    val: string
  ) => {
    setCustomEnvVars((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: val } : v))
    )
  }

  const handleDeploy = async () => {
    if (!template) return
    setIsDeploying(true)
    try {
      const mergedEnvs: Record<string, string> = { ...defaultEnvValues }
      for (const custom of customEnvVars) {
        if (custom.key.trim()) {
          mergedEnvs[custom.key.trim()] = custom.value
        }
      }

      const secretKeys = new Set(
        (template.blueprint?.envSchema ?? [])
          .filter((envDef) => envDef.isSecret)
          .map((envDef) => envDef.key)
      )

      const envVarsArray = Object.entries(mergedEnvs).map(([key, value]) => {
        const isSecret = secretKeys.has(key)
        return {
          key,
          value,
          type: isSecret ? ("secret" as const) : ("plain" as const),
          masked: isSecret,
          isStoredSecret: isSecret,
        }
      })

      const { data: payload } = await eden.api.deploy.submit.post({
        sourceType: "TEMPLATE",
        templateId: template.id || template.slug,
        name: appName,
        subdomain: subdomain.replace(/\.pfnapp\.com$/, ""),
        billingMode: "PAYG",
        resourcePlanId: selectedPlan?.id || selectedPlanCode.toLowerCase(),
        cpu: cpuOverride ?? undefined,
        memory: memoryOverride ?? undefined,
        envVars: envVarsArray,
      })

      if (!payload || !("ok" in payload) || !payload.ok) {
        const msg =
          payload && "message" in payload
            ? String(payload.message)
            : "Deploy failed"
        throw new Error(msg)
      }

      toast.success(`Deployment for ${appName} started!`)
      router.push(
        `/${lang}/console/app/platform/${encodeURIComponent(appName)}?tab=deployments`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deploy failed")
    } finally {
      setIsDeploying(false)
    }
  }

  if (isTemplateLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {messages.loadingCatalogPlans}
          </p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <h2 className="text-xl font-semibold">Template Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested template &quot;{templateSlug}&quot; could not be loaded.
        </p>
        <Button asChild>
          <Link href={`/${lang}/console/app/marketplace`}>
            <ArrowLeft className="mr-1 size-4" />
            {messages.backToMarketplace || "Back to Marketplace"}
          </Link>
        </Button>
      </div>
    )
  }

  const blueprint = template.blueprint
  const envSchema: AppTemplateBlueprintEnvVar[] = blueprint?.envSchema ?? []
  const dependencies = blueprint?.dependencies ?? []

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header & Back Navigation */}
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href={`/${lang}/console/app/marketplace`}>
            <ArrowLeft className="mr-1 size-4" />
            {messages.backToMarketplace || "Back to Marketplace"}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-start gap-3">
            <TemplateLogo
              iconUrl={template.iconUrl}
              slug={template.slug}
              name={template.name}
              className="size-12 rounded-xl"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {template.name}
                </h1>
                {template.isOfficial && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  >
                    <ShieldCheckIcon className="mr-1 size-3.5" />
                    {messages.official}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {template.category}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {template.tagline || template.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (65% width): Config, Env Vars, Resources */}
        <div className="space-y-6 lg:col-span-8">
          {/* App Name & Subdomain */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                1. {messages.appNameLabel} & Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="app-name">{messages.appNameLabel}</Label>
                  <Input
                    id="app-name"
                    value={appName}
                    onChange={(e) => setAppNameOverride(e.target.value)}
                    placeholder={messages.appNamePlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-subdomain">
                    {messages.assignedSubdomainLabel}
                  </Label>
                  <div className="flex items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <span className="truncate">{subdomain}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Region & Hardware Resource Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                2. {messages.hostingPackageHeading}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Target Region */}
                <div className="space-y-2">
                  <Label>{messages.targetRegionLabel}</Label>
                  <Select
                    value={selectedRegion?.code || "SINGAPORE"}
                    onValueChange={(val) => setSelectedRegionCodeOverride(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRegions.map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          <span className="flex items-center gap-2">
                            <span>{r.flag}</span>
                            <span>{r.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hardware Plan */}
                <div className="space-y-2">
                  <Label>{messages.hardwareResourcePlanLabel}</Label>
                  <Select
                    value={selectedPlanCode}
                    onValueChange={(val) => {
                      setSelectedPlanCode(val)
                      const target = plans.find((p) => p.code === val)
                      if (target) {
                        const defaults = getPlanResources(target)
                        setCpuOverride(defaults.cpu)
                        setMemoryOverride(defaults.mem)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => {
                        const res = getPlanResources(p)
                        const offer =
                          p.offers?.find(
                            (o) =>
                              o.regionCode === selectedRegion?.code ||
                              o.regionId === selectedRegion?.id
                          ) || p.offers?.[0]
                        const priceStr = offer
                          ? formatBillingMoney(
                              Number.parseFloat(offer.periodPrice),
                              offer.currency
                            )
                          : ""
                        return (
                          <SelectItem key={p.code} value={p.code}>
                            <div className="flex w-full items-center justify-between gap-4">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {res.cpu}m CPU · {res.mem}MB RAM · {res.storage}
                                GB disk {priceStr ? `(${priceStr}/bln)` : ""}
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dependencies & Storage Info Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1">
                  <Cpu className="size-3.5 text-primary" />
                  {cpuOverride ?? 500}m CPU
                </span>
                <span className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1">
                  <Lightning className="size-3.5 text-primary" />
                  {memoryOverride ?? 512}MB RAM
                </span>
                <span className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1">
                  <HardDrive className="size-3.5 text-primary" />
                  {messages.persistentVolumeLabel}{" "}
                  {blueprint?.storage?.sizeGbDefault ?? 2}{" "}
                  {messages.gbMountedAt}{" "}
                  {blueprint?.storage?.mountPath || "/opt/data"}
                </span>
                {dependencies.length > 0 && (
                  <span className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1">
                    <Database className="size-3.5 text-primary" />
                    {dependencies.map((d) => d.serviceType).join(", ")}
                  </span>
                )}
              </div>

              {hasStorageConflict && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <WarningIcon className="size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {messages.insufficientStorageTitle}
                    </p>
                    <p className="mt-0.5">
                      {messages.insufficientStorageDescription
                        ?.replace("{planStorage}", String(planStorageGb))
                        ?.replace("{requiredStorage}", String(requiredStorage))}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Environment Variables: Key-Value Form & Raw .env Tabs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">
                  3. {messages.envConfigHeading}
                  {envSchema.filter((f) => !f.isHidden).length +
                    customEnvVars.length}
                  )
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {messages.autoPopulated}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="form">
                    {messages.keyValueEditor || "Key-Value"}
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    {messages.rawEnvPaste || "Raw .env"}
                  </TabsTrigger>
                </TabsList>

                {/* Key-Value Form Tab */}
                <TabsContent value="form" className="space-y-4">
                  {envSchema
                    .filter((f) => !f.isHidden)
                    .map((field) => {
                      const currentValue =
                        envOverrides[field.key] ??
                        defaultEnvValues[field.key] ??
                        ""
                      const isRevealed = revealedSecrets[field.key] ?? false

                      return (
                        <div
                          key={field.key}
                          className="space-y-1.5 rounded-lg border border-border bg-card/60 p-3.5 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor={`env-${field.key}`}
                                className="font-mono text-xs font-medium"
                              >
                                {field.key}
                              </Label>
                              {field.required && (
                                <span className="text-xs font-bold text-destructive">
                                  *
                                </span>
                              )}
                              {field.isSecret && (
                                <Lock className="size-3 text-muted-foreground" />
                              )}
                            </div>
                            {field.isFixed && (
                              <Badge variant="outline" className="text-[10px]">
                                {messages.fixedBadge}
                              </Badge>
                            )}
                          </div>

                          {field.description && (
                            <p className="text-xs text-muted-foreground">
                              {field.description}
                            </p>
                          )}

                          <div className="pt-1">
                            {field.dataType === "boolean" ? (
                              <div className="flex items-center gap-3">
                                <Switch
                                  id={`env-${field.key}`}
                                  checked={currentValue === "true"}
                                  disabled={field.isFixed}
                                  onCheckedChange={(checked) =>
                                    handleEnvChange(
                                      field.key,
                                      checked ? "true" : "false"
                                    )
                                  }
                                />
                                <span className="text-xs text-muted-foreground">
                                  {currentValue === "true"
                                    ? messages.enabledLabel
                                    : messages.disabledLabel}
                                </span>
                              </div>
                            ) : field.options && field.options.length > 0 ? (
                              <Select
                                value={currentValue}
                                disabled={field.isFixed}
                                onValueChange={(val) =>
                                  handleEnvChange(field.key, val)
                                }
                              >
                                <SelectTrigger className="w-full font-mono text-xs">
                                  <SelectValue
                                    placeholder={
                                      messages.selectOptionPlaceholder
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="relative">
                                <Input
                                  id={`env-${field.key}`}
                                  type={
                                    field.isSecret && !isRevealed
                                      ? "password"
                                      : "text"
                                  }
                                  value={currentValue}
                                  disabled={field.isFixed}
                                  onChange={(e) =>
                                    handleEnvChange(field.key, e.target.value)
                                  }
                                  className="pr-9 font-mono text-xs"
                                  placeholder={
                                    field.defaultValue ||
                                    (field.isSecret ? "••••••••••••" : "")
                                  }
                                />
                                {field.isSecret && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleSecretReveal(field.key)
                                    }
                                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    {isRevealed ? (
                                      <EyeSlash className="size-4" />
                                    ) : (
                                      <Eye className="size-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                  {/* Custom Environment Variables */}
                  <div className="border-t border-border pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {messages.customEnvVarsHeading}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {messages.customEnvVarsDescription}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddCustomEnvVar}
                      >
                        <Plus className="mr-1 size-3.5" />
                        {messages.addVariable}
                      </Button>
                    </div>

                    {customEnvVars.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                        {messages.noCustomEnvVars}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customEnvVars.map((v) => (
                          <div key={v.id} className="flex items-center gap-2">
                            <Input
                              placeholder="KEY"
                              value={v.key}
                              onChange={(e) =>
                                handleCustomEnvVarChange(
                                  v.id,
                                  "key",
                                  e.target.value.toUpperCase()
                                )
                              }
                              className="w-1/3 font-mono text-xs"
                            />
                            <Input
                              placeholder={messages.valuePlaceholder}
                              value={v.value}
                              onChange={(e) =>
                                handleCustomEnvVarChange(
                                  v.id,
                                  "value",
                                  e.target.value
                                )
                              }
                              className="flex-1 font-mono text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCustomEnvVar(v.id)}
                            >
                              <Trash className="size-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Raw .env Paste Tab */}
                <TabsContent value="raw" className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {messages.pasteEnvPlaceholder ||
                      "Paste your environment variables in standard KEY=VALUE format."}
                  </p>
                  <Textarea
                    value={currentRawEnv}
                    onChange={(e) => setRawEnvInput(e.target.value)}
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                    placeholder="API_KEY=sk-xxxx\nPORT=8080"
                  />
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={handleApplyRawEnv}>
                      <Check className="mr-1 size-3.5" />
                      {messages.applyEnv || "Apply .env"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (35% width): Summary, Cost, Balance & Launch CTA */}
        <div className="space-y-6 lg:col-span-4">
          <Card className="sticky top-6">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-base font-semibold">
                {messages.deployHeading} {template.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {/* Plan Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {messages.monthlySubscription}
                  </span>
                  <span className="font-semibold">{selectedPlan?.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {messages.targetRegionLabel}
                  </span>
                  <span className="font-medium">
                    {selectedRegion?.flag} {selectedRegion?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {messages.cpuLabel} / {messages.ramLabel}
                  </span>
                  <span className="font-mono">
                    {cpuOverride ?? 500}m / {memoryOverride ?? 512}MB
                  </span>
                </div>
              </div>

              {/* Price Calculation */}
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    Estimasi Biaya
                  </span>
                  <div className="text-right">
                    <span className="text-xl font-bold">
                      {formatBillingMoney(effectiveMonthlyPrice, currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      / bln
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  ~ {formatBillingMoney(effectiveHourlyRate, currency)} / jam
                  (PAYG)
                </p>
              </div>

              {/* Balance Verification */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Saldo Organisasi
                  </span>
                  <span className="font-semibold">
                    {formatBillingMoney(currentBalance, currency)}
                  </span>
                </div>

                {hasInsufficientBalance ? (
                  <div className="space-y-2.5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                    <div className="flex items-start gap-2">
                      <WarningIcon className="size-4 shrink-0" />
                      <div>
                        <p className="font-medium">
                          {messages.insufficientBalance}
                        </p>
                        <p className="mt-0.5 text-[11px] opacity-90">
                          {messages.firstMonthRequires}{" "}
                          {formatBillingMoney(effectiveMonthlyPrice, currency)}
                          {messages.currentBalanceIs}{" "}
                          {formatBillingMoney(currentBalance, currency)}.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full bg-red-600 text-white hover:bg-red-700"
                      onClick={() => setQuickTopUpOpen(true)}
                    >
                      {messages.quickTopUp}
                      {formatBillingMoney(balanceDeficit, currency)})
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3.5" />
                    <span>Saldo mencukupi untuk menjalankan stack</span>
                  </div>
                )}
              </div>

              {/* Launch CTA */}
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  className="w-full bg-emerald-600 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-500"
                  disabled={
                    isDeploying ||
                    catalogLoading ||
                    hasStorageConflict ||
                    hasInsufficientBalance
                  }
                  onClick={handleDeploy}
                >
                  <RocketLaunchIcon className="mr-1.5 size-4" />
                  {isDeploying
                    ? messages.deployingStack
                    : messages.confirmDeploy}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Deployment terisolasi & diawasi otomatis.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <QuickTopUpDialog
        open={quickTopUpOpen}
        onOpenChange={setQuickTopUpOpen}
        suggestedAmount={balanceDeficit}
        currency={currency}
        onSuccess={fetchAccount}
      />
    </div>
  )
}
