import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  CheckCircle,
  Cpu,
  RocketLaunchIcon,
  Package,
} from "@/components/ui/phosphor-icons"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

export interface MarketplaceTemplateItem {
  id: string
  slug: string
  name: string
  tagline: string
  description?: string
  iconUrl?: string | null
  category:
    | "ALL"
    | "AI"
    | "AUTOMATION"
    | "CMS"
    | "DATABASE"
    | "DEVELOPER_TOOLS"
    | "ANALYTICS"
    | "UTILITIES"
    | string
  isOfficial?: boolean
  isFeatured?: boolean
  installCount?: number
  priceMonthly?: number
  currency?: string
  blueprint: AppTemplateBlueprint
}

export interface TemplateCardProps {
  template: MarketplaceTemplateItem
  onDeploy: (template: MarketplaceTemplateItem) => void
  isDeploying?: boolean
}

export function formatResourceSummary(blueprint: AppTemplateBlueprint): string {
  const cpu = blueprint.resources?.defaultCpu
    ? `${blueprint.resources.defaultCpu}m CPU`
    : null
  const memory = blueprint.resources?.defaultMemory
    ? `${blueprint.resources.defaultMemory}MB RAM`
    : null

  const deps = blueprint.dependencies ?? []
  const depSummary =
    deps.length > 0
      ? `Requires ${deps
          .map((d) => {
            const count = 1
            const type =
              d.serviceType === "POSTGRESQL"
                ? "Postgres"
                : d.serviceType === "MYSQL"
                  ? "MySQL"
                  : d.serviceType === "REDIS"
                    ? "Redis"
                    : d.serviceType
            return `${count}x ${type}`
          })
          .join(", ")}`
      : null

  return [cpu, memory, depSummary].filter(Boolean).join(" · ")
}

export function TemplateCard({
  template,
  onDeploy,
  isDeploying = false,
}: TemplateCardProps) {
  const resourceSummary = formatResourceSummary(template.blueprint)

  return (
    <Card className="flex flex-col justify-between overflow-hidden border border-border bg-card transition-colors hover:border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 p-2 text-foreground">
            {template.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.iconUrl}
                alt={template.name}
                className="size-7 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                  e.currentTarget.parentElement?.classList.add("fallback-icon")
                }}
              />
            ) : (
              <Package className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-semibold text-foreground">
                {template.name}
              </h3>
              {template.isOfficial && (
                <span
                  title="Official Verified"
                  aria-label="Official Verified"
                  className="inline-flex items-center text-emerald-500"
                >
                  <CheckCircle className="size-4 fill-emerald-500/20 text-emerald-500" />
                </span>
              )}
            </div>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {template.tagline}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] font-normal tracking-wider text-muted-foreground uppercase"
        >
          {template.category}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-5 pt-0">
        {resourceSummary && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Cpu className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{resourceSummary}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-border/40 p-4 pt-3">
        <Button
          onClick={() => onDeploy(template)}
          disabled={isDeploying}
          className="w-full gap-2"
          size="sm"
        >
          <RocketLaunchIcon className="size-4" />
          <span>Deploy</span>
        </Button>
      </CardFooter>
    </Card>
  )
}
