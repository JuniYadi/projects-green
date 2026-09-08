"use client"

import { CheckCircle } from "@phosphor-icons/react"
import { ClusterTelemetryCards } from "@/modules/deploy/ui/cluster-telemetry-cards"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type AppOverviewTabProps = {
  stack: StackSummaryDTO
  locale: string
}

export function AppOverviewTab({ stack, locale }: AppOverviewTabProps) {
  const targetDomain = stack.customDomain || stack.subdomain

  const formattedPrice = stack.catalogPlanPrice
    ? stack.catalogPlanCurrency === "IDR"
      ? `Rp ${Number(stack.catalogPlanPrice).toLocaleString("id-ID")} / bulan`
      : `$${stack.catalogPlanPrice} / month`
    : stack.hourlyCost
      ? `$${stack.hourlyCost} / hour (PAYG)`
      : "Included with Package"

  const orderedDate = stack.orderedAt || stack.createdAt
  const formattedOrdered = orderedDate
    ? new Date(orderedDate).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—"

  const formattedRenewal = stack.renewalAt
    ? new Date(stack.renewalAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Auto-renews monthly"

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Live Telemetry Metrics (~58% width) */}
      <div className="space-y-4 lg:col-span-7">
        <ClusterTelemetryCards
          appSlug={stack.slug}
          title="Resource Telemetry"
          columns={1}
          chartHeight={125}
        />
      </div>

      {/* Right Column: Commercial Subscription & Platform Specification (~42% width) */}
      <div className="space-y-6 lg:col-span-5">
        {/* Card 1: Subscription & Billing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Subscription & Billing
            </CardTitle>
            <CardDescription className="text-xs">
              Active package, catalog plan, and renewal cycle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Catalog Plan</span>
              <span className="font-semibold text-foreground">
                {stack.catalogPlanName ??
                  (stack.resourcePlanId
                    ? `${stack.resourcePlanId.toUpperCase()} Plan`
                    : "Small")}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Price & Cycle</span>
              <span className="font-semibold text-foreground">
                {formattedPrice}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Billing Status</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Active ({stack.billingState ?? "Good Standing"})
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Ordered On</span>
              <span className="font-medium text-foreground">
                {formattedOrdered}
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-muted-foreground">Next Renewal</span>
              <span className="font-medium text-foreground">
                {formattedRenewal}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Platform Specification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Platform Specification
            </CardTitle>
            <CardDescription className="text-xs">
              Template engine, service port, and cluster routing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Template / Engine</span>
              <span className="font-medium text-foreground">
                {stack.templateName ??
                  stack.framework ??
                  stack.templateId ??
                  "Custom Container"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Service Port</span>
              <span className="font-mono font-medium text-foreground">
                {stack.port ? `Port ${stack.port}` : "Port 80/443"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Allocated Resources</span>
              <span className="font-medium text-foreground">
                {stack.cpu
                  ? stack.cpu >= 100
                    ? `${stack.cpu / 1000} vCPU`
                    : `${stack.cpu} vCPU`
                  : "0.5 vCPU"}{" "}
                • {stack.memory ? `${stack.memory} MB RAM` : "512 MB RAM"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Environment Secrets</span>
              <span className="font-medium text-foreground">
                {stack.envCount !== undefined
                  ? `${stack.envCount} Variables (Vault)`
                  : "Configured in Vault"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">GitOps Status</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-500">
                <CheckCircle size={13} />
                ArgoCD Synced
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-muted-foreground">Canonical Endpoint</span>
              <span className="truncate font-mono text-[11px] text-primary">
                {targetDomain ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
