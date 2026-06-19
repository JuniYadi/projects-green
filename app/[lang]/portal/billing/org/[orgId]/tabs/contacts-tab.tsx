"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UsersIcon } from "@phosphor-icons/react"

type ContactsTabProps = {
  orgId: string
}

export function ContactsTab({ orgId }: ContactsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-muted-foreground" />
          Billing Contacts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Billing contacts management for this organization will be
            available here once the admin contacts feature is implemented.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Organization ID: {orgId}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
