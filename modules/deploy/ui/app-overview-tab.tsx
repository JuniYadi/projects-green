"use client"

import Link from "next/link"
import {
  ListMagnifyingGlass,
  GearSix,
  CheckCircle,
} from "@phosphor-icons/react"
import { ClusterTelemetryCards } from "@/modules/deploy/ui/cluster-telemetry-cards"
import { Button } from "@/components/ui/button"
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

  return (
    <div className="space-y-6">
      {/* 3 Core Metrics Telemetry (CPU, Memory, Network) per Deployment */}
      <ClusterTelemetryCards appSlug={stack.slug} title="Resource Telemetry" />

      {/* Consolidated Platform Specification & Runtime Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Platform Specification & Runtime
            </CardTitle>
            <CardDescription className="text-xs">
              Configured template, cluster routing, and runtime resources
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="xs">
              <Link
                href={`/${locale}/console/app/deployments?app=${stack.slug}`}
              >
                <ListMagnifyingGlass size={13} className="mr-1" />
                Deployments
              </Link>
            </Button>
            <Button asChild variant="outline" size="xs">
              <Link
                href={`/${locale}/console/app/settings?app=${stack.slug}&tab=env`}
              >
                <GearSix size={13} className="mr-1" />
                Settings & Env
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/20 p-3 sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">
                Framework / Template
              </span>
              <p className="mt-0.5 font-medium text-foreground">
                {stack.templateName ??
                  stack.framework ??
                  stack.templateId ??
                  "Custom Container"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Service Port</span>
              <p className="mt-0.5 font-mono font-medium text-foreground">
                {stack.port ? `Port ${stack.port}` : "Port 80/443"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Allocated Resources</span>
              <p className="mt-0.5 font-medium text-foreground">
                {stack.cpu
                  ? stack.cpu >= 100
                    ? `${stack.cpu / 1000} vCPU`
                    : `${stack.cpu} vCPU`
                  : "0.5 vCPU"}{" "}
                • {stack.memory ? `${stack.memory} MB RAM` : "512 MB RAM"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Environment Secrets</span>
              <p className="mt-0.5 font-medium text-foreground">
                {stack.envCount !== undefined
                  ? `${stack.envCount} Variables (Vault)`
                  : "Configured in Vault"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-500" />
              ArgoCD Synced • Last deployed{" "}
              {stack.lastDeployedAt
                ? new Date(stack.lastDeployedAt).toLocaleString(locale)
                : "Never"}
            </span>
            <span className="font-mono text-[11px] text-primary">
              {targetDomain ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
