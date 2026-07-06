import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminOrgs, type AdminOrgSummary } from "@/lib/billing-client"

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

async function ContactsList() {
  const { orgs } = await getAdminOrgs({ limit: 50 })

  if (orgs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No organizations found.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Organizations ({orgs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orgs.map((org: AdminOrgSummary) => (
            <div
              key={org.orgId}
              className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{org.orgName}</p>
                <p className="text-xs text-muted-foreground">
                  {org.activeSubscriptions} active subscription{org.activeSubscriptions !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium">
                  {formatCurrency(org.balance)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Monthly spend: {formatCurrency(org.monthlySpend)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function ContactsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Billing Contacts</h1>
        <p className="text-muted-foreground">
          Manage billing notification recipients across organizations
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <ContactsList />
      </Suspense>
    </main>
  )
}
