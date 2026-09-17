"use client"

import { useParams } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type TabGeneralProps = {
  stack: StackSummaryDTO
  lastDeployedAt: string | null
}

export function TabGeneral({ stack, lastDeployedAt }: TabGeneralProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pConsoleSettingsTabGeneral

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.name}
            </dt>
            <dd className="font-medium">{stack.name}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.slug}
            </dt>
            <dd className="font-mono text-xs">{stack.slug}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.framework}
            </dt>
            <dd className="font-medium">{stack.framework ?? t.notDetected}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.branch}
            </dt>
            <dd className="font-mono text-xs">{stack.branchName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.resourcePlan}
            </dt>
            <dd className="font-medium">
              {stack.resourcePlanId ?? t.defaultPlan}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.billingMode}
            </dt>
            <dd className="font-medium">{stack.billingMode ?? "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.subdomain}
            </dt>
            <dd className="font-mono text-xs">
              {stack.subdomain ?? t.notConfigured}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.customDomain}
            </dt>
            <dd className="font-mono text-xs">
              {stack.customDomain ?? t.notConfigured}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.lastDeployed}
            </dt>
            <dd className="font-medium">
              {lastDeployedAt
                ? new Date(lastDeployedAt).toLocaleString()
                : t.never}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {t.billingState}
            </dt>
            <dd className="font-medium">{stack.billingState}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">{t.futureUpdate}</p>
      </CardContent>
    </Card>
  )
}
