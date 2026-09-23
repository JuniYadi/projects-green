"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BellIcon } from "@phosphor-icons/react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type AlertsTabProps = {
  orgId: string
}

export function AlertsTab({ orgId }: AlertsTabProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingOrgTabsAlertsTab
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="h-5 w-5 text-muted-foreground" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.organizationIdLabel} {orgId}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
