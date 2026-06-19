"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BellIcon } from "@phosphor-icons/react"

type AlertsTabProps = {
  orgId: string
}

export function AlertsTab({ orgId }: AlertsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="h-5 w-5 text-muted-foreground" />
          Billing Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Alert preferences for this organization will be available here
            once the admin alerts configuration is implemented.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Organization ID: {orgId}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
