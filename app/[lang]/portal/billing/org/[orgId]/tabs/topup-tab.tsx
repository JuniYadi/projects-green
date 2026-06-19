"use client"

import { AdminTopupForm } from "@/components/billing/admin/admin-topup-form"

type TopupTabProps = {
  orgId: string
}

export function TopupTab({ orgId }: TopupTabProps) {
  return (
    <div className="space-y-4">
      <AdminTopupForm orgId={orgId} />
    </div>
  )
}
