"use client"

import { ArrowClockwise, ArrowSquareOut } from "@phosphor-icons/react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import type {
  DeploymentStatusDTO,
  StackBillingState,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type { DeployLogScope } from "@/modules/deploy/deploy.types"
import { DeployTimeline } from "@/modules/deploy/ui/deploy-timeline"
import { LogsPanel } from "@/modules/deploy/ui/logs-panel"

type AppMonitorProps = {
  stack: StackSummaryDTO
  deployment: DeploymentStatusDTO | null
  logScope: DeployLogScope
  onLogScopeChange: (scope: DeployLogScope) => void
}

const STATUS_TONE: Record<string, string> = {
  running: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  failed: "border-rose-500/20 bg-rose-500/5 text-rose-400",
  building: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  deploying: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  queued: "border-amber-500/20 bg-amber-500/5 text-amber-400",
  idle: "border-border bg-muted/30 text-muted-foreground",
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
}: AppMonitorProps) {
  const status = deployment?.status ?? stack.status
  const tone = STATUS_TONE[status] ?? STATUS_TONE.idle
  const billingNote = BILLING_NOTE[stack.billingState]
  const targetDomain = stack.customDomain || stack.subdomain
  const deployId = deployment?.id ?? stack.latestDeploymentId ?? undefined

  return (
    <div className="space-y-6">
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
                {stack.framework ?? "Unknown framework"} &bull; branch{" "}
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

            {targetDomain ? (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a
                  href={`https://${targetDomain}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowSquareOut size={15} />
                  Visit app
                </a>
              </Button>
            ) : null}
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
                {targetDomain ?? "Not configured"}
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

          {deployment?.status === "failed" && deployment.failureReason ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
              <p className="font-semibold">Last deployment failed</p>
              <p>{deployment.failureReason}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {deployId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deployment status</CardTitle>
            <CardDescription>
              Live status, events, and logs sourced from the deployment system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Status timeline</h3>
              <DeployTimeline deployId={deployId} status={status} />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Build and runtime logs</h3>
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
            No deployments yet for this app. Start a deploy to see live status,
            events, and logs here.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
