import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentMethodsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Payment Methods</h1>
        <p className="text-sm text-muted-foreground">
          Manage platform payment methods
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/portal/billing/payments?tab=bank-accounts" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>Manage linked bank accounts for payouts and withdrawals</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/billing/payments?tab=currencies" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle>Currencies</CardTitle>
              <CardDescription>Configure supported currencies and exchange rates</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/billing/payments?tab=gateways" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle>Gateways</CardTitle>
              <CardDescription>Configure payment gateway integrations</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
  )
}
