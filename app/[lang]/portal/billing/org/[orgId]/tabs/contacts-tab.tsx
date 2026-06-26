"use client"

import { BillingContactsList } from "@/components/billing/billing-contacts-list"

type ContactsTabProps = {
  orgId: string
}

export function ContactsTab({ orgId }: ContactsTabProps) {
  return <BillingContactsList orgId={orgId} />
}
