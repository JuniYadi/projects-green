"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Check,
  Clock,
  Cpu,
  Database,
  Eye,
  EyeSlash,
  HardDrive,
  Lightning,
  RocketLaunchIcon,
  ShieldCheckIcon,
} from "@/components/ui/phosphor-icons"
import { TemplateLogo } from "./template-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getCatalogProduct,
  type CatalogPlan,
  type CatalogProductDetailResponse,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { AppTemplateBlueprintEnvVar } from "@/modules/deploy/blueprint/app-template-blueprint.schema"
import { buildInitialEnvVars } from "@/modules/deploy/blueprint/app-template-blueprint.service"

import type { MarketplaceTemplateItem } from "./template-card"
export type { MarketplaceTemplateItem }

export interface DynamicLaunchDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: MarketplaceTemplateItem | null
  onDeploy: (payload: {
    templateId: string
    templateSlug: string
    appName: string
    subdomain: string
    billingMode: "PAYG" | "PACKAGE"
    envVars: Record<string, string>
    cpu?: number
    memory?: number
    resourcePlanId?: string
  }) => Promise<void> | void
  isDeploying?: boolean
  userBalance?: number
  currency?: string
}

const ADJECTIVES = [
  "sparkling",
  "swift",
  "radiant",
  "cosmic",
  "nimble",
  "vibrant",
  "stellar",
  "luminous",
  "daring",
  "zenith",
]

const NOUNS = [
  "star",
  "nebula",
  "aurora",
  "phoenix",
  "pulsar",
  "falcon",
  "voyager",
  "atlas",
  "horizon",
  "comet",
]

export function generateSuggestedAppName(templateSlug: string): string {
  const cleanSlug = templateSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${cleanSlug || "app"}-${adj}-${noun}`
}

function getPlanResources(plan: CatalogPlan | undefined) {
  if (!plan) return { cpu: 500, mem: 512 }
  const res = plan.resources as Record<string, unknown> | undefined
  const provisioning = res?.provisioning as Record<string, unknown> | undefined
  const features = res?.features as Record<string, unknown> | undefined

  const cpu =
    Number(provisioning?.cpu) ||
    Number(features?.defaultCpu) ||
    Number(res?.defaultCpu) ||
    Number(res?.cpu) ||
    (plan.code === "MEDIUM" ? 1000 : 500)

  const rawMem =
    Number(provisioning?.memory) ||
    Number(features?.defaultMem) ||
    Number(res?.defaultMem) ||
    Number(res?.memory) ||
    (plan.code === "MEDIUM" ? 2048 : 512)

  // Normalize memory if stored as large integer (e.g. 1024048 -> 1024)
  const mem = rawMem > 32768 ? Math.round(rawMem / 1000) : rawMem

  return { cpu, mem }
}

export function DynamicLaunchDrawer({
  open,
  onOpenChange,
  template,
  onDeploy,
  isDeploying = false,
  userBalance: _userBalance = 25.5,
  currency = "USD",
}: DynamicLaunchDrawerProps) {
  const [appNameOverride, setAppNameOverride] = useState<string | null>(null)
  const [catalogData, setCatalogData] =
    useState<CatalogProductDetailResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("SMALL")
  const [cpuOverride, setCpuOverride] = useState<number | null>(null)
  const [memoryOverride, setMemoryOverride] = useState<number | null>(null)
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({})
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      setCatalogLoading(true)
      try {
        const res = await getCatalogProduct("APP_HOSTING", currency)
        if (isMounted && res) {
          setCatalogData(res)
          const firstPlan = res.product?.plans?.[0]
          if (firstPlan) {
            setSelectedPlanCode(firstPlan.code)
            const defaults = getPlanResources(firstPlan)
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
    loadCatalog()
    return () => {
      isMounted = false
    }
  }, [currency])

  const plans = useMemo(() => {
    return catalogData?.product?.plans ?? []
  }, [catalogData])

  const selectedPlan: CatalogPlan | undefined = useMemo(() => {
    return plans.find((p) => p.code === selectedPlanCode) || plans[0]
  }, [plans, selectedPlanCode])

  // Reset or initialize CPU/RAM whenever template or selectedPlan changes if not overridden
  const currentCpu =
    cpuOverride ??
    getPlanResources(selectedPlan).cpu ??
    template?.blueprint?.resources?.defaultCpu ??
    500

  const currentMemory =
    memoryOverride ??
    getPlanResources(selectedPlan).mem ??
    template?.blueprint?.resources?.defaultMemory ??
    512

  const initialEnvValues = useMemo(() => {
    return template ? buildInitialEnvVars(template.blueprint) : {}
  }, [template])

  const envValues = useMemo(() => {
    return { ...initialEnvValues, ...envOverrides }
  }, [initialEnvValues, envOverrides])

  const appName = useMemo(() => {
    if (appNameOverride !== null) return appNameOverride
    return template ? generateSuggestedAppName(template.slug) : ""
  }, [template, appNameOverride])

  const setAppName = (name: string) => setAppNameOverride(name)

  const subdomain = useMemo(() => {
    const sanitized = (appName || template?.slug || "app")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
    return `${sanitized || "app"}.pfnapp.com`
  }, [appName, template?.slug])

  const handleEnvChange = (key: string, value: string) => {
    setEnvOverrides((prev) => ({
      ...prev,
      [key]: value,
    }))
  }
  const toggleSecretVisibility = (key: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleConfirmDeploy = async () => {
    if (!template) return
    await onDeploy({
      templateId: template.id,
      templateSlug: template.slug,
      appName: appName.trim() || template.name,
      subdomain,
      billingMode: "PACKAGE",
      envVars: envValues,
      cpu: currentCpu,
      memory: currentMemory,
      resourcePlanId: (selectedPlanCode || "small").toLowerCase(),
    })
  }
  if (!template) return null

  const { blueprint } = template
  const envSchema = blueprint?.envSchema || []
  const dependencies = blueprint?.dependencies || []
  const storage = blueprint?.storage

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border p-6 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted/40 p-2 shadow-xs">
              <TemplateLogo
                slug={template.slug}
                name={template.name}
                iconUrl={template.iconUrl}
                className="size-6"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="truncate text-lg font-semibold">
                  Deploy {template.name}
                </SheetTitle>
                {template.isOfficial && (
                  <Badge
                    variant="secondary"
                    className="gap-1 border border-border px-1.5 py-0 text-xs font-normal"
                  >
                    <ShieldCheckIcon className="size-3 text-emerald-500" />
                    Official
                  </Badge>
                )}
              </div>
              <SheetDescription className="truncate text-xs text-muted-foreground">
                {template.tagline ||
                  template.description ||
                  "1-Click instant launch"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* App Configuration Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-name-input" className="text-sm font-medium">
                App Name
              </Label>
              <Input
                id="app-name-input"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. n8n-sparkling-star"
                className="font-mono text-sm"
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
              <span className="text-muted-foreground">
                Assigned Subdomain:{" "}
              </span>
              <span className="font-mono font-medium text-foreground">
                https://{subdomain}
              </span>
            </div>
          </div>

          {/* Resource & Package Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Hosting Package & Sizing
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                Monthly Subscription
              </Badge>
            </div>

            {/* Real Catalog Plans */}
            {plans.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {plans.map((plan) => {
                  const isSelected = selectedPlanCode === plan.code
                  const monthlyOffer =
                    plan.offers?.find((o) => o.billingPeriod === "MONTHLY") ||
                    plan.offers?.[0]

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlanCode(plan.code)
                        const defaults = getPlanResources(plan)
                        setCpuOverride(defaults.cpu)
                        setMemoryOverride(defaults.mem)
                      }}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold">
                          {plan.name}
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 text-primary" />
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {monthlyOffer?.periodPrice
                          ? `${formatBillingMoney(monthlyOffer.periodPrice, monthlyOffer.currency || currency)} / month`
                          : "Free / Included"}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : catalogLoading ? (
              <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                Loading available catalog plans…
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                Starter Plan — Monthly Subscription
              </div>
            )}

            {/* Resource inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Cpu className="size-3.5" />
                  <Label
                    htmlFor="custom-cpu-input"
                    className="text-xs font-medium"
                  >
                    CPU (mCore)
                  </Label>
                </div>
                <Input
                  id="custom-cpu-input"
                  type="number"
                  min={100}
                  max={8000}
                  step={100}
                  value={currentCpu}
                  onChange={(e) =>
                    setCpuOverride(Number(e.target.value) || 100)
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HardDrive className="size-3.5" />
                  <Label
                    htmlFor="custom-mem-input"
                    className="text-xs font-medium"
                  >
                    RAM (MB)
                  </Label>
                </div>
                <Input
                  id="custom-mem-input"
                  type="number"
                  min={128}
                  max={32768}
                  step={128}
                  value={currentMemory}
                  onChange={(e) =>
                    setMemoryOverride(Number(e.target.value) || 128)
                  }
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
              <Database className="size-4 text-muted-foreground" />
              <div className="flex-1 text-xs">
                <span className="text-muted-foreground">DB Dependencies: </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {dependencies.length > 0
                    ? dependencies.map((d) => d.serviceType).join(", ")
                    : "Self-contained / In-Stock"}
                </span>
              </div>
            </div>

            {storage?.enabled && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <HardDrive className="size-3.5" />
                <span>
                  Persistent Volume: {storage.sizeGbDefault} GB mounted at{" "}
                  <code className="font-mono font-medium text-foreground">
                    {storage.mountPath}
                  </code>
                </span>
              </div>
            )}
          </div>

          {/* Dynamic Form Generator from envSchema */}
          {envSchema.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Environment Configuration ({envSchema.length})
                </h4>
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] text-muted-foreground"
                >
                  <Lightning className="size-2.5 text-primary" />
                  Auto-populated
                </Badge>
              </div>

              <div className="space-y-3.5">
                {envSchema.map((field: AppTemplateBlueprintEnvVar) => {
                  const fieldKey = field.key
                  const val = envValues[fieldKey] ?? ""
                  const isSecret = Boolean(field.isSecret)
                  const isRevealed = Boolean(revealedSecrets[fieldKey])

                  return (
                    <div key={fieldKey} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`env-field-${fieldKey}`}
                          className="text-xs font-medium"
                        >
                          {field.label || fieldKey}
                          {field.required && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
                        </Label>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {fieldKey}
                        </span>
                      </div>

                      {field.description && (
                        <p className="text-[11px] text-muted-foreground">
                          {field.description}
                        </p>
                      )}

                      {field.dataType === "select" && field.options ? (
                        <Select
                          value={val}
                          onValueChange={(newVal) =>
                            handleEnvChange(fieldKey, newVal)
                          }
                        >
                          <SelectTrigger
                            id={`env-field-${fieldKey}`}
                            className="w-full text-xs"
                          >
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem
                                key={opt}
                                value={opt}
                                className="text-xs"
                              >
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.dataType === "boolean" ? (
                        <div className="flex items-center gap-3 pt-1">
                          <Switch
                            id={`env-field-${fieldKey}`}
                            checked={val === "true" || val === "1"}
                            onCheckedChange={(checked) =>
                              handleEnvChange(
                                fieldKey,
                                checked ? "true" : "false"
                              )
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {val === "true" || val === "1"
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex items-center">
                          <Input
                            id={`env-field-${fieldKey}`}
                            type={
                              isSecret && !isRevealed
                                ? "password"
                                : field.dataType === "number"
                                  ? "number"
                                  : "text"
                            }
                            value={val}
                            onChange={(e) =>
                              handleEnvChange(fieldKey, e.target.value)
                            }
                            placeholder={
                              field.defaultValue || `Enter ${field.label}`
                            }
                            className={`text-xs ${
                              isSecret ? "pr-9 font-mono" : ""
                            }`}
                          />
                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(fieldKey)}
                              aria-label={
                                isRevealed
                                  ? `Hide ${field.label}`
                                  : `Show ${field.label}`
                              }
                              className="absolute right-2.5 text-muted-foreground hover:text-foreground"
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
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border p-6">
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeploying}
              className="w-1/3"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeploy}
              disabled={isDeploying}
              className="w-2/3 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isDeploying ? (
                <>
                  <Clock className="mr-2 size-4 animate-spin" />
                  Deploying Stack…
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="mr-2 size-4" />
                  Confirm & Deploy Instantly
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
