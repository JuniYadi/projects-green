import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  CheckCircle,
  Cpu,
  RocketLaunchIcon,
} from "@/components/ui/phosphor-icons"
import { TemplateLogo } from "./template-logo"
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
    <Card className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all hover:border-border/80 hover:shadow-xs">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 p-1.5 text-foreground">
              <TemplateLogo
                slug={template.slug}
                name={template.name}
                iconUrl={template.iconUrl}
                className="size-5"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {template.name}
                </h3>
                {template.isOfficial && (
                  <span
                    title="Official Verified"
                    aria-label="Official Verified"
                    className="inline-flex shrink-0 items-center text-emerald-500"
                  >
                    <CheckCircle className="size-3.5 fill-emerald-500/20 text-emerald-500" />
                  </span>
                )}
              </div>
              <Badge
                variant="secondary"
                className="mt-0.5 h-4 border-0 px-1 py-0 text-[9px] font-medium text-muted-foreground"
              >
                {template.category.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {template.tagline}
        </p>

        {resourceSummary && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
            <Cpu className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{resourceSummary}</span>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-border/40 pt-2.5">
        <Button
          onClick={() => onDeploy(template)}
          disabled={isDeploying}
          className="h-8 w-full gap-1.5 text-xs font-medium"
          size="sm"
        >
          <RocketLaunchIcon className="size-3.5" />
          <span>Deploy</span>
        </Button>
      </div>
    </Card>
  )
}
