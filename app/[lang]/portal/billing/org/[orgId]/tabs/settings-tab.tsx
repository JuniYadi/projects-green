"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GearIcon } from "@phosphor-icons/react"

type SettingsTabProps = {
  orgId: string
}

export function SettingsTab({ orgId }: SettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GearIcon className="h-5 w-5 text-muted-foreground" />
          Billing Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Billing settings for this organization will be available here once
            the admin settings configuration is implemented.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Organization ID: {orgId}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
