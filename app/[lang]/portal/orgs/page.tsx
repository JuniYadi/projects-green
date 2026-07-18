import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { OrgOverviewStatsCards } from "./org-overview-stats-cards"
import { OrgSummaryTable } from "@/app/[lang]/portal/billing/overview/org-summary-table"

export default async function PortalOrgsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Organization Overview</h1>
        <p className="text-muted-foreground">
          Platform-wide organization stats and management
        </p>
      </header>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        <OrgOverviewStatsCards />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <OrgSummaryTable linkPrefix="/portal/orgs" linkSuffix="?page=billing" limit={100} />
      </Suspense>
    </main>
  )
}
