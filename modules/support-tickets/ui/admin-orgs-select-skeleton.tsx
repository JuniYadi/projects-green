"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function AdminOrgsSelectSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
