"use client"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type TicketTableSkeletonProps = {
  rows?: number
}

const COLUMNS = [
  { label: "Ticket ID", width: "w-28" },
  { label: "Subject", width: "w-64" },
  { label: "Status", width: "w-20" },
  { label: "Department", width: "w-28" },
  { label: "Priority", width: "w-20" },
  { label: "Service", width: "w-24" },
]

export function TicketTableSkeleton({ rows = 5 }: TicketTableSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table header */}
      <div className="flex items-center gap-4 border-b border-border px-1 pb-2">
        {COLUMNS.map((col) => (
          <Skeleton key={col.label} className={`h-4 ${col.width}`} />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-1 py-3">
          {COLUMNS.map((col) => (
            <Skeleton key={col.label} className={`h-4 ${col.width}`} />
          ))}
        </div>
      ))}
    </div>
  )
}