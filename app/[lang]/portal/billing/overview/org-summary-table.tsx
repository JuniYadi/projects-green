"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminOrgs, type AdminOrgSummary } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

function makeColumns(
  linkPrefix: string,
  linkSuffix?: string
): ColumnDef<AdminOrgSummary>[] {
  const suffix = linkSuffix ?? ""
  return [
    {
      accessorKey: "orgName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Organization" />
      ),
      cell: ({ row }) => (
        <Link
          href={`${linkPrefix}/${row.original.orgId}${suffix}`}
          className="font-medium hover:underline"
        >
          {row.original.orgName}
        </Link>
      ),
    },
    {
      accessorKey: "balance",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Balance" />
      ),
      cell: ({ row }) =>
        formatBillingMoney(row.original.balance, row.original.currency),
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
      cell: ({ row }) =>
        formatBillingMoney(row.original.monthlySpend, row.original.currency),
    },
  ]
}

export function OrgSummaryTable({
  linkPrefix = "/portal/billing/org",
  linkSuffix,
  limit = 50,
}: {
  linkPrefix?: string
  linkSuffix?: string
  limit?: number
}) {
  const [orgs, setOrgs] = useState<AdminOrgSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      const all: AdminOrgSummary[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await getAdminOrgs({ limit, page })
        if (cancelled) return
        all.push(...res.orgs)
        totalPages = res.pagination.totalPages
        page++
      } while (page <= totalPages)
      if (!cancelled) setOrgs(all)
    }
    fetchAll()
      .catch((err) => setError(err.message))
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

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
      <CardContent className="p-0">
        <DataTable
          tableId="portal-billing-org-summary"
          columns={makeColumns(linkPrefix, linkSuffix)}
          data={orgs}
          searchPlaceholder="Search organizations..."
          searchableColumns={["orgName"]}
        />
      </CardContent>
    </Card>
  )
}
