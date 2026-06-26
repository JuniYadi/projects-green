import { ContactsGuard } from "@/components/billing/contacts-guard"

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ContactsGuard>{children}</ContactsGuard>
}
