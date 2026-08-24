"use client"

import { useState } from "react"
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
  onConfirm: (subdomain: string) => void | Promise<void>
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
  const [submitting, setSubmitting] = useState(false)
  // Sync subdomain when template changes (new deploy target)
  const displaySubdomain =
    subdomain || (template ? makeSubdomain(template) : "")

  const handleConfirm = async () => {
    const value = displaySubdomain.trim()
    if (!value || submitting) return

    setSubmitting(true)
    try {
      await onConfirm(value)
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
                <span className="text-sm">Plan</span>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  PAYG
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
