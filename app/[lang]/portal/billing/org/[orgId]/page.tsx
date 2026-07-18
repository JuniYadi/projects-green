import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { OrgBillingDashboard } from "./org-billing-dashboard"

export type { TabValue } from "./org-billing-dashboard"

type PageProps = {
  params: Promise<{ lang: string; orgId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function OrgBillingPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, orgId } = await params
  const { tab } = await searchParams

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <Suspense fallback={<OrgBillingSkeleton />}>
        <OrgBillingDashboard
          lang={lang}
          orgId={orgId}
          defaultTab={tab}
        />
      </Suspense>
    </main>
  )
}

function OrgBillingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}
