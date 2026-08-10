"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeftIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SquaresFour,
} from "@/components/ui/phosphor-icons"
import { useAdminAddonsQuery } from "@/hooks/use-billing-data"
const BILLING_MODE_LABELS: Record<string, string> = {
  RECURRING: "Recurring",
  ONE_TIME: "One-time",
  USAGE: "Usage",
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function PortalBillingAddonsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const {
    data,
    isLoading: loading,
    error,
  } = useAdminAddonsQuery({
    search: search.trim() || undefined,
    currency: "IDR",
  })
  const addons = data?.addons ?? []

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value.trim()) params.set("q", e.target.value)
    else params.delete("q")
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const addonColumns: ColumnDef<(typeof addons)[number]>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description && (
            <p className="text-xs text-muted-foreground">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "billingMode",
      header: "Billing mode",
      cell: ({ row }) =>
        BILLING_MODE_LABELS[row.original.billingMode] ??
        row.original.billingMode,
    },
    {
      id: "prices",
      header: "Prices",
      accessorFn: (row) => row.prices.length,
      cell: ({ row }) =>
        `${row.original.prices.length} price${row.original.prices.length === 1 ? "" : "s"}`,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Link
          href={`/portal/billing/catalog/addons/${row.original.code.toLowerCase()}`}
        >
          <Button variant="ghost" size="sm">
            <GearSixIcon className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/portal/billing/catalog">
              <Button variant="ghost" size="icon">
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Add-ons</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable add-ons that can be attached to plans and priced per term.
          </p>
        </div>
        <Link href="/portal/billing/catalog/addons/new">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Add-on
          </Button>
        </Link>
      </header>

      <div className="relative max-w-sm">
        <Input
          placeholder="Search add-ons..."
          value={search}
          onChange={handleSearch}
          className="pl-9"
          aria-label="Search add-ons"
        />
        <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error instanceof Error ? error.message : "Unable to load add-ons."}
          </CardContent>
        </Card>
      ) : loading ? (
        <LoadingSkeleton />
      ) : addons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SquaresFour className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No add-ons match your search.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardTitle className="sr-only">Add-ons list</CardTitle>
          <DataTable
            tableId="portal-billing-addons"
            columns={addonColumns}
            data={addons}
            searchableColumns={["code", "name", "billingMode"]}
            searchPlaceholder="Search add-ons table..."
            emptyMessage="No add-ons match your search."
          />
        </Card>
      )}
    </main>
  )
}
