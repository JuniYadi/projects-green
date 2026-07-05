import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

export default function PortalBillingTopupPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Top Up</h1>
        <p className="text-muted-foreground">
          Manage organization balance top-ups
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Topping up organization balances is managed through the organization billing dashboard. 
              Navigate to your organization&apos;s billing section to add funds to your account balance.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/portal/billing/org"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Organization Billing
              </Link>
              <p className="text-xs text-muted-foreground">
                You can manage top-ups, view balance history, and configure auto-recharge settings from the organization billing dashboard.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
