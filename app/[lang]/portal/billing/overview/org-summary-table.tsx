"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminOrgs, type AdminOrgSummary } from "@/lib/billing-client"

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

const columns: ColumnDef<AdminOrgSummary>[] = [
  {
    accessorKey: "orgName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Organization" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.orgName}</span>
    ),
  },
  {
    accessorKey: "balance",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Balance" />
    ),
    cell: ({ row }) => formatCurrency(row.original.balance),
  },
  {
    accessorKey: "activeSubscriptions",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subscriptions" />
    ),
  },
  {
    accessorKey: "monthlySpend",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Monthly Spend" />
    ),
    cell: ({ row }) => formatCurrency(row.original.monthlySpend),
  },
]

export function OrgSummaryTable() {
  const params = useParams<{ lang: string }>()
  const [orgs, setOrgs] = useState<AdminOrgSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminOrgs({ limit: 50 })
      .then((res) => setOrgs(res.orgs))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          Failed to load organizations: {error}
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
        <DataTable
          columns={columns}
          data={orgs}
          searchableColumns={["orgName"]}
          searchPlaceholder="Search organizations..."
          emptyMessage="No organizations found."
        />
        {orgs.length > 0 && (
          <div className="mt-4 space-y-2">
            {orgs.map((org) => (
              <Link
                key={org.orgId}
                href={`/${params.lang}/portal/billing/org/${org.orgId}`}
                className="block rounded-md border p-3 text-sm hover:bg-muted"
              >
                <span className="font-medium">{org.orgName}</span>
                <span className="ml-2 text-muted-foreground">
                  {formatCurrency(org.balance)} balance
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
