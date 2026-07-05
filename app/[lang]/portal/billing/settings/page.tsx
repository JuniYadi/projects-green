import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GearIcon, BuildingsIcon, ArrowRightIcon } from "@phosphor-icons/react"
import Link from "next/link"

export default function BillingSettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Billing Settings</h1>
        <p className="text-muted-foreground">
          Platform-wide billing configuration
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BuildingsIcon className="h-5 w-5 text-muted-foreground" />
              Organization Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure billing settings for individual organizations. Each org
              can have its own payment methods, alerts, and currency preferences.
            </p>
            <Link
              href="/portal/billing/org"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Manage Organizations
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GearIcon className="h-5 w-5 text-muted-foreground" />
              Per-Org Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Access billing settings tabs for a specific organization via the
              org detail page under the Billing section.
            </p>
            <p className="text-xs text-muted-foreground">
              Navigate to an organization to configure payment methods, balance
              alerts, and currency preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
