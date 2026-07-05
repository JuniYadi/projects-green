import { Skeleton } from "@/components/ui/skeleton"

export default function PortalWhatsAppUsageLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      <Skeleton className="h-[370px] w-full" />

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </main>
  )
}
