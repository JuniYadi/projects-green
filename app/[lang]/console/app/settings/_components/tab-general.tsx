"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type TabGeneralProps = {
  stack: StackSummaryDTO
  lastDeployedAt: string | null
}

export function TabGeneral({ stack, lastDeployedAt }: TabGeneralProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General</CardTitle>
        <CardDescription>
          Basic information about this application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Name
            </dt>
            <dd className="font-medium">{stack.name}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Slug
            </dt>
            <dd className="font-mono text-xs">{stack.slug}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Framework
            </dt>
            <dd className="font-medium">
              {stack.framework ?? "Not detected"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Branch
            </dt>
            <dd className="font-mono text-xs">{stack.branchName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Resource Plan
            </dt>
            <dd className="font-medium">
              {stack.resourcePlanId ?? "Default"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Billing Mode
            </dt>
            <dd className="font-medium">{stack.billingMode ?? "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Subdomain
            </dt>
            <dd className="font-mono text-xs">
              {stack.subdomain ?? "Not configured"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Custom Domain
            </dt>
            <dd className="font-mono text-xs">
              {stack.customDomain ?? "Not configured"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Last Deployed
            </dt>
            <dd className="font-medium">
              {lastDeployedAt
                ? new Date(lastDeployedAt).toLocaleString()
                : "Never"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Billing State
            </dt>
            <dd className="font-medium">{stack.billingState}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">
          Repository URL and creation date will be available in a future update.
        </p>
      </CardContent>
    </Card>
  )
}
