"use client"

import { type ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type AdminMember } from "@/lib/billing-client"

type MemberBillingTableProps = {
  members: AdminMember[]
  lang: string
  isLoading?: boolean
}

export function MemberBillingTable({ members, lang }: MemberBillingTableProps) {
  const columns: ColumnDef<AdminMember, unknown>[] = [
    {
      accessorKey: "name",
      header: "Member",
      cell: ({ row }) => {
        const name = row.getValue("name") as string
        const email = row.original.email
        return (
          <div className="flex flex-col">
            <span className="font-medium">{name}</span>
            <span className="text-sm text-muted-foreground">{email}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.getValue("role") as string
        return <Badge variant="outline">{role}</Badge>
      },
    },
    {
      accessorKey: "subscriptionCount",
      header: "Subscriptions",
      cell: ({ row }) => {
        const active = row.original.activeSubscriptionCount
        const total = row.getValue("subscriptionCount") as number
        return (
          <span>
            {active} / {total} active
          </span>
        )
      },
    },
    {
      accessorKey: "monthlySpendIdr",
      header: "Monthly Spend",
      cell: ({ row }) => {
        const spend = row.getValue("monthlySpendIdr") as string
        return <span>{spend}</span>
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const userId = row.original.userId
        return (
          <Button asChild size="sm" variant="outline">
            <Link href={`/${lang}/portal/billing/members/${userId}`}>
              View Billing
            </Link>
          </Button>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={members}
      searchableColumns={["name", "email"]}
      searchPlaceholder="Search members..."
      emptyMessage="No members found."
    />
  )
}
