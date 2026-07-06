import { Suspense } from "react"
import Link from "next/link"
import { getAdminOrgs, type AdminOrgSummary } from "@/lib/billing-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PortalBillingAlertsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Billing Alerts</h1>
        <p className="text-muted-foreground">
          Platform-wide billing alerts management
        </p>
      </header>

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        }
      >
        <AlertsOrgList />
      </Suspense>
    </main>
  )
}

async function AlertsOrgList() {
  const { ok, orgs } = await getAdminOrgs({ limit: 100 })

  if (!ok || orgs.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No organizations found.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orgs.map((org) => (
            <OrgRow key={org.orgId} org={org} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function OrgRow({ org }: { org: AdminOrgSummary }) {
  return (
    <Link
      href={`/portal/billing/org/${org.orgId}`}
      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{org.orgName}</span>
        <span className="text-xs text-muted-foreground">
          {org.activeSubscriptions} active subscription{org.activeSubscriptions !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-medium">
          Rp {Number(org.balance).toLocaleString("id-ID")}
        </span>
        <span className="text-xs text-muted-foreground">
          Rp {Number(org.monthlySpend).toLocaleString("id-ID")}/mo
        </span>
      </div>
    </Link>
  )
}
