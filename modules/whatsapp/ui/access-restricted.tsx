"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

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
        <p className="text-sm font-bold text-destructive">
          <WhatsAppText id="s197" />
        </p>
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            <WhatsAppText id="s198" />{" "}
            <span className="font-medium">{current ?? "none"}</span>
          </p>
          <p>
            <WhatsAppText id="s199" />
            <span className="font-medium">{required}</span>
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{action}</p>
      </CardContent>
    </Card>
  )
}
