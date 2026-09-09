"use client"

import {
  ArrowClockwise,
  ArrowSquareOut,
  GearSix,
  ListMagnifyingGlass,
  ChartLine,
} from "@phosphor-icons/react"
import Link from "next/link"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
import type {
  DeploymentStatusDTO,
  StackBillingState,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type { DeployLogScope } from "@/modules/deploy/deploy.types"
import { DeployStepTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { LogsPanel } from "@/modules/deploy/ui/logs-panel"

type AppMonitorProps = {
  stack: StackSummaryDTO
  deployment: DeploymentStatusDTO | null
  logScope: DeployLogScope
  onLogScopeChange: (scope: DeployLogScope) => void
  onRetry?: () => void
  liveDomain?: string
  locale?: string
  hideSummaryHeader?: boolean
}

const BILLING_NOTE: Record<StackBillingState, string | null> = {
  ACTIVE: null,
  PAYMENT_GRACE:
    "Payment grace period active. Top up your balance to avoid suspension.",
  SUSPENDED:
    "This app is suspended due to payment issues. Top up your balance to resume.",
}

export function AppMonitor({
  stack,
  deployment,
  logScope,
  onLogScopeChange,
  onRetry,
  liveDomain,
  locale: localeProp,
  hideSummaryHeader = false,
}: AppMonitorProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const tMonitor = messages.console.app.timeline.monitor
  const status = deployment?.status ?? stack.status
  const tone = STATUS_TONE[status] ?? STATUS_TONE.idle
  const billingNote = BILLING_NOTE[stack.billingState]
  const targetDomain = liveDomain ?? (stack.customDomain || stack.subdomain)
  const deployId = deployment?.id ?? stack.latestDeploymentId ?? undefined

  return (
    <div className="space-y-6">
      {hideSummaryHeader && deployment?.status === "failed" ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 font-semibold text-destructive">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                Deployment Failed
              </p>
              <p className="text-foreground">
                {deployment.failureReason ||
                  "The deployment encountered an unexpected error during build or cluster synchronization."}
              </p>
              {deployment.failureReason?.includes("REGISTRY") ? (
                <p className="pt-1 text-muted-foreground">
                  💡 <strong>Action Required:</strong> {tMonitor.registryHint}
                </p>
              ) : deployment.failureReason?.includes("timed out") ? (
                <p className="pt-1 text-muted-foreground">
                  💡 <strong>Action Required:</strong> {tMonitor.timeoutHint}
                </p>
              ) : null}
            </div>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="shrink-0"
              >
                <ArrowClockwise className="mr-1.5 h-3.5 w-3.5" />
                Retry Deploy
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {!hideSummaryHeader && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-3 text-lg">
                  {stack.name}
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}
                  >
                    {DEPLOY_STATUS_LABELS[status] ?? status}
                  </span>
                </CardTitle>
                <CardDescription>
                  {stack.framework ??
                    (stack.sourceType === "TEMPLATE" || stack.templateId
                      ? stack.templateId && stack.templateId.length < 20
                        ? `${stack.templateId.charAt(0).toUpperCase() + stack.templateId.slice(1)} (Template)`
                        : "Template"
                      : "Custom Workload")}{" "}
                  <span className="font-medium text-foreground">
                    {stack.branchName}
                  </span>
                  {stack.resourcePlanId ? (
                    <>
                      {" "}
                      &bull; plan{" "}
                      <span className="font-medium text-foreground">
                        {stack.resourcePlanId}
                      </span>
                    </>
                  ) : null}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  <Link
                    href={`${localizePathname({ pathname: "/console/app/settings", locale })}?app=${stack.slug}&tab=env`}
                  >
                    <GearSix className="size-3.5" />
                    <span>Settings & Env</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  <Link
                    href={`${localizePathname({ pathname: "/console/app/logs", locale })}?app=${stack.slug}`}
                  >
                    <ListMagnifyingGlass className="size-3.5" />
                    <span>Logs</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  <Link
                    href={`${localizePathname({ pathname: "/console/app/metrics", locale })}?app=${stack.slug}`}
                  >
                    <ChartLine className="size-3.5" />
                    <span>Metrics</span>
                  </Link>
                </Button>
                {targetDomain ? (
                  <Button
                    asChild
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs"
                  >
                    <a
                      href={`https://${targetDomain}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>Open App</span>
                      <ArrowSquareOut className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingNote ? (
              <div
                className="flex items-start justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300"
                role="alert"
              >
                <span>{billingNote}</span>
                <Link
                  href="/console/billing/topup"
                  className="font-semibold underline underline-offset-4"
                >
                  Top up
                </Link>
              </div>
            ) : null}

            <dl className="grid gap-3 text-xs sm:grid-cols-3">
              <div className="space-y-1">
                <dt className="tracking-wide text-muted-foreground uppercase">
                  Domain
                </dt>
                <dd className="font-medium text-foreground">
                  {targetDomain ? (
                    <a
                      href={`https://${targetDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      <span>{targetDomain}</span>
                      <ArrowSquareOut className="size-3" />
                    </a>
                  ) : (
                    "Not configured"
                  )}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="tracking-wide text-muted-foreground uppercase">
                  Last deployed
                </dt>
                <dd className="font-medium text-foreground">
                  {stack.lastDeployedAt
                    ? new Date(stack.lastDeployedAt).toLocaleString()
                    : "Never"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="tracking-wide text-muted-foreground uppercase">
                  Attempt
                </dt>
                <dd className="font-medium text-foreground">
                  {deployment ? deployment.attempt : "—"}
                </dd>
              </div>
            </dl>

            {deployment?.status === "failed" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 font-semibold text-destructive">
                      <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                      Deployment Failed
                    </p>
                    <p className="text-foreground">
                      {deployment.failureReason ||
                        "The deployment encountered an unexpected error during build or cluster synchronization."}
                    </p>
                    {deployment.failureReason?.includes("REGISTRY") ? (
                      <p className="pt-1 text-muted-foreground">
                        💡 <strong>Action Required:</strong>{" "}
                        {tMonitor.registryHint}
                      </p>
                    ) : deployment.failureReason?.includes("timed out") ? (
                      <p className="pt-1 text-muted-foreground">
                        💡 <strong>Action Required:</strong>{" "}
                        {tMonitor.timeoutHint}
                      </p>
                    ) : null}
                  </div>
                  {onRetry ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      className="shrink-0"
                    >
                      <ArrowClockwise className="mr-1.5 h-3.5 w-3.5" />
                      Retry Deploy
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
      {deployId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tMonitor.statusTitle}</CardTitle>
            <CardDescription>{tMonitor.statusDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{tMonitor.timelineTitle}</h3>
              <DeployStepTimeline
                deployId={deployId}
                status={status}
                liveDomain={targetDomain ?? undefined}
                skipBuildSteps={stack.sourceType === "TEMPLATE"}
                onRetry={status === "failed" ? onRetry : undefined}
                locale={locale}
              />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">{tMonitor.logsTitle}</h3>
              <LogsPanel
                deployId={deployId}
                status={status}
                scope={logScope}
                attempt={deployment ? deployment.attempt : 1}
                onScopeChange={onLogScopeChange}
              />
            </section>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <ArrowClockwise size={18} />
            {tMonitor.noDeployments}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
