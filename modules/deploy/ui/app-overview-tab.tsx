"use client"

import Link from "next/link"
import {
  ListMagnifyingGlass,
  GearSix,
  CheckCircle,
  Clock,
  ShieldCheck,
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
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type AppOverviewTabProps = {
  stack: StackSummaryDTO
  locale: string
}

export function AppOverviewTab({ stack, locale }: AppOverviewTabProps) {
  const targetDomain = stack.customDomain || stack.subdomain
  const tone = STATUS_TONE[stack.status] ?? STATUS_TONE.idle
  const statusLabel = DEPLOY_STATUS_LABELS[stack.status] ?? stack.status

  return (
    <div className="space-y-6">
      {/* 3 Core Metrics Telemetry (CPU, Memory, Network) per Deployment */}
      <ClusterTelemetryCards appSlug={stack.slug} title="Resource Telemetry" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Active Deployment */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Active Deployment
              </CardTitle>
              <CardDescription className="text-xs">
                Production release currently live in cluster
              </CardDescription>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              <span>{statusLabel}</span>
            </span>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/20 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Source / Origin</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {stack.templateName ??
                    (stack.branchName && stack.branchName !== "/"
                      ? stack.branchName
                      : "Marketplace Template")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Deployed</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {stack.lastDeployedAt
                    ? new Date(stack.lastDeployedAt).toLocaleString(locale)
                    : "Never"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Current Step</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {stack.currentStepLabel ?? "Application Live"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Target Domain</span>
                <p className="mt-0.5 truncate font-medium text-primary">
                  {targetDomain ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle size={14} className="text-emerald-500" />
                Pipeline Synced with ArgoCD
              </span>
              <Button asChild variant="outline" size="xs">
                <Link
                  href={`/${locale}/console/app/deployments?app=${stack.slug}`}
                >
                  <ListMagnifyingGlass size={13} className="mr-1" />
                  View Deployments
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Application Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Application Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Infrastructure and routing metadata
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="xs">
              <Link
                href={`/${locale}/console/app/settings?app=${stack.slug}&tab=general`}
              >
                <GearSix size={13} className="mr-1" />
                Configure
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">
                Framework / Template
              </span>
              <span className="font-medium text-foreground">
                {stack.templateName ??
                  stack.framework ??
                  stack.templateId ??
                  "Custom Container"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Default Subdomain</span>
              <span className="truncate font-mono font-medium text-foreground">
                {stack.subdomain ? `${stack.subdomain}.pfnapp.dev` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Custom Domain</span>
              <span className="font-medium text-foreground">
                {stack.customDomain ? (
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <CheckCircle size={13} />
                    {stack.customDomain}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Compute Resources</span>
              <span className="font-medium text-foreground">
                {stack.cpu ? `${stack.cpu} vCPU` : "0.5 vCPU"} •{" "}
                {stack.memory ? `${stack.memory} MB` : "512 MB"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-muted-foreground">Billing Plan</span>
              <span className="font-medium text-foreground">
                {stack.resourcePlanId ?? "small"} ({stack.billingMode ?? "PAYG"}
                )
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 4: Environment & Secrets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Environment & Secrets
              </CardTitle>
              <CardDescription className="text-xs">
                Configuration and Vault credentials injected into pods
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="xs">
              <Link
                href={`/${locale}/console/app/settings?app=${stack.slug}&tab=env`}
              >
                <GearSix size={13} className="mr-1" />
                Edit Env
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck size={16} className="text-primary" />
                <span>Vault Encryption Active</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Environment variables and API secrets are encrypted and mounted
                as Kubernetes Secrets at runtime.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">
                Variables Configured
              </span>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                {stack.envCount !== undefined
                  ? `${stack.envCount} Variables`
                  : "Configured in Vault"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 5: Live Activity & Logs Quick Jump */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Recent Activity & Runtime Logs
            </CardTitle>
            <CardDescription className="text-xs">
              Live stdout/stderr stream from container replicas
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="xs">
            <Link href={`/${locale}/console/app/logs?app=${stack.slug}`}>
              <ListMagnifyingGlass size={13} className="mr-1" />
              Stream Logs
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/70 bg-black/80 p-3 font-mono text-xs text-zinc-300">
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock size={13} />
              <span>Container runtime running healthy.</span>
            </div>
            <p className="mt-1 text-emerald-400">
              ✓ Ready for inbound traffic on{" "}
              {stack.port ? `port ${stack.port}` : "port 80/443"}.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
