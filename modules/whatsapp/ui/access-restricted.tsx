"use client"

import { Warning } from "@phosphor-icons/react"
import { Card, CardContent } from "@/components/ui/card"

type AccessRestrictedProps = {
  required: string
  current: string | null
  action: string
}

export function AccessRestricted({
  required,
  current,
  action,
}: AccessRestrictedProps) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <Warning className="mb-3 size-10 text-destructive" weight="fill" />
        <p className="text-sm font-bold text-destructive">Access restricted</p>
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            Current role: <span className="font-medium">{current ?? "none"}</span>
          </p>
          <p>
            Required role: <span className="font-medium">{required}</span>
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{action}</p>
      </CardContent>
    </Card>
  )
}
