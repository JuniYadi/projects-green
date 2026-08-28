"use client"

import { useEffect, useState } from "react"
import type { Icon } from "@phosphor-icons/react"
import {
  ArrowsSplit,
  ChartBar,
  Database,
  FlowArrow as Workflow,
  Robot,
  RocketLaunch,
  WarningCircle,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  MANAGED_APP_TEMPLATES,
  type ManagedAppTemplate,
} from "@/modules/deploy/managed-app-templates"
import { cn } from "@/lib/utils"
import { getCatalogProduct, type CatalogPlan } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { getPlanResources } from "@/modules/deploy/catalog-plan-utils"
type TemplateVisual = {
  icon: Icon
  description: string
  iconClassName: string
  iconBackgroundClassName: string
}

const TEMPLATE_VISUALS: Record<ManagedAppTemplate["id"], TemplateVisual> = {
  n8n: {
    icon: Workflow,
    description: "Workflow Automation",
    iconClassName: "text-indigo-500",
    iconBackgroundClassName: "bg-indigo-500/10",
  },
  hermes: {
    icon: Robot,
    description: "AI Agent UI",
    iconClassName: "text-violet-500",
    iconBackgroundClassName: "bg-violet-500/10",
  },
  "9router": {
    icon: ArrowsSplit,
    description: "AI LLM Router",
    iconClassName: "text-emerald-500",
    iconBackgroundClassName: "bg-emerald-500/10",
  },
  umami: {
    icon: ChartBar,
    description: "Privacy Analytics",
    iconClassName: "text-amber-500",
    iconBackgroundClassName: "bg-amber-500/10",
  },
}

type TemplateCatalogProps = {
  onSelect: (template: ManagedAppTemplate) => void
  isDeploying?: boolean
}

function TemplateCatalog({
  onSelect,
  isDeploying = false,
}: TemplateCatalogProps) {
  return (
    <section aria-labelledby="ready-made-app-heading" className="space-y-4">
      <div className="flex items-center gap-3">
        <h2
          id="ready-made-app-heading"
          className="text-sm font-semibold whitespace-nowrap"
        >
          Or launch a ready-made app
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MANAGED_APP_TEMPLATES.map((template) => {
          const visual = TEMPLATE_VISUALS[template.id]
          const Icon = visual.icon

          return (
            <Card
              key={template.id}
              className="flex min-w-0 flex-col overflow-hidden"
            >
              <CardHeader className="gap-3 p-4">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    visual.iconBackgroundClassName
                  )}
                >
                  <Icon className={cn("size-5", visual.iconClassName)} />
                </div>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate text-sm">
                    {template.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {visual.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Database className="size-3" />
                  {template.engineType}
                </Badge>
              </CardContent>
              <CardFooter className="mt-auto p-4 pt-0">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={() => onSelect(template)}
                  disabled={isDeploying}
                >
                  {isDeploying ? "Deploying…" : "Deploy"}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

type QuickDeployDialogProps = {
  template: ManagedAppTemplate | null
  open: boolean
  onClose: () => void
  onConfirm: (payload: {
    subdomain: string
    cpu: number
    memory: number
    resourcePlanId: string
    billingMode: "PACKAGE"
  }) => void | Promise<void>
}

const makeSubdomain = (template: ManagedAppTemplate) =>
  `${template.defaultSubdomain}-${Math.random().toString(36).slice(2, 7)}`


function QuickDeployDialog({
  template,
  open,
  onClose,
  onConfirm,
}: QuickDeployDialogProps) {
  const [subdomain, setSubdomain] = useState(() =>
    template ? makeSubdomain(template) : ""
  )
  const [plans, setPlans] = useState<CatalogPlan[]>([])
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("SMALL")
  const [cpu, setCpu] = useState<number>(500)
  const [memory, setMemory] = useState<number>(512)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadPlans() {
      try {
        const res = await getCatalogProduct("APP_HOSTING")
        if (isMounted && res?.product?.plans) {
          setPlans(res.product.plans)
          const firstPlan = res.product.plans[0]
          if (firstPlan) {
            setSelectedPlanCode(firstPlan.code)
            const defaults = getPlanResources(firstPlan)
            setCpu(defaults.cpu)
            setMemory(defaults.mem)
          }
        }
      } catch (err) {
        console.error("Failed to fetch app hosting catalog", err)
      }
    }
    loadPlans()
    return () => {
      isMounted = false
    }
  }, [])
  // Sync subdomain when template changes (new deploy target)
  const displaySubdomain =
    subdomain || (template ? makeSubdomain(template) : "")

  const handleConfirm = async () => {
    const value = displaySubdomain.trim()
    if (!value || submitting) return

    setSubmitting(true)
    try {
      await onConfirm({
        subdomain: value,
        cpu,
        memory,
        resourcePlanId: (selectedPlanCode || "starter").toLowerCase(),
        billingMode: "PACKAGE",
      })
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) {
          onClose()
        } else if (nextOpen && template) {
          setSubdomain(makeSubdomain(template))
          setSubmitting(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {template && (
          <>
            <DialogHeader>
              <DialogTitle>Deploy {template.name}</DialogTitle>
              <DialogDescription>
                Configure your app before launching it to Kubernetes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label htmlFor="quick-deploy-subdomain" className="text-sm">
                  Subdomain
                </label>
                <Input
                  id="quick-deploy-subdomain"
                  value={displaySubdomain}
                  onChange={(event) => setSubdomain(event.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="quick-deploy-plan"
                    className="text-sm font-medium"
                  >
                    Package Plan
                  </label>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Monthly Subscription
                  </Badge>
                </div>
                {plans.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {plans.map((pkg) => {
                      const isSelected = selectedPlanCode === pkg.code
                      const monthlyOffer =
                        pkg.offers?.find(
                          (o) => o.billingPeriod === "MONTHLY"
                        ) || pkg.offers?.[0]
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlanCode(pkg.code)
                            const defaults = getPlanResources(pkg)
                            setCpu(defaults.cpu)
                            setMemory(defaults.mem)
                          }}
                          className={`flex flex-col items-start justify-center rounded-lg border p-2.5 text-left text-xs transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 font-semibold text-primary"
                              : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span>{pkg.name}</span>
                            {isSelected && (
                              <Badge className="h-4 px-1 text-[9px]">
                                Active
                              </Badge>
                            )}
                          </div>
                          <span className="mt-0.5 text-[10px] text-muted-foreground">
                            {monthlyOffer?.periodPrice
                              ? `${formatBillingMoney(monthlyOffer.periodPrice, monthlyOffer.currency || "IDR")} / mo`
                              : "Included"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
                    Starter Plan — Monthly Subscription
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="quick-deploy-cpu"
                    className="text-xs font-medium"
                  >
                    CPU (mCore)
                  </label>
                  <Input
                    id="quick-deploy-cpu"
                    type="number"
                    min={100}
                    max={8000}
                    step={100}
                    value={cpu}
                    onChange={(e) => setCpu(Number(e.target.value) || 100)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="quick-deploy-memory"
                    className="text-xs font-medium"
                  >
                    Memory (MB)
                  </label>
                  <Input
                    id="quick-deploy-memory"
                    type="number"
                    min={128}
                    max={32768}
                    step={128}
                    value={memory}
                    onChange={(e) => setMemory(Number(e.target.value) || 128)}
                    disabled={submitting}
                  />
                </div>
              </div>
              <p
                className={cn(
                  "flex gap-2 rounded-lg border border-amber-500/20",
                  "bg-amber-500/5 p-3 text-xs text-muted-foreground"
                )}
              >
                <WarningCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>
                  A managed {template.engineType} database slot will be
                  allocated automatically.
                </span>
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting || !subdomain.trim()}
              >
                <RocketLaunch className="size-4" />
                {submitting ? "Launching…" : "Launch to Kubernetes"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { QuickDeployDialog, TemplateCatalog }
export type { QuickDeployDialogProps, TemplateCatalogProps }
