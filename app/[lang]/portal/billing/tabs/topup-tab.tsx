"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TopupFormEnhanced } from "@/components/billing/topup-form-enhanced"
import { CreditCardIcon } from "@phosphor-icons/react"

type TopupTabProps = {
  lang: string
}

export function TopupTab({ lang }: TopupTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCardIcon className="h-5 w-5" />
            Top Up Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopupFormEnhanced />
        </CardContent>
      </Card>
    </div>
  )
}
