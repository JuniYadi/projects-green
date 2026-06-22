"use client"

import { useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { DataTable } from "@/components/data-table"
import type { AdminAdjustment } from "@/lib/billing-client"

type AdjustmentTableProps = {
  adjustments: AdminAdjustment[]
  isLoading?: boolean
}

function formatCurrency(amountIdr: string): string {
  const amount = Number.parseFloat(amountIdr)
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    signDisplay: "never",
  }).format(Math.abs(amount))
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr))
}

function AdjustmentTypeBadge({ type }: { type: string }) {
  const isCredit = type === "CREDIT"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        isCredit
          ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      )}
    >
      {type}
    </span>
  )
}

function AmountCell({ amountIdr, type }: { amountIdr: string; type: string }) {
  const isCredit = type === "CREDIT"
  const formattedAmount = formatCurrency(amountIdr)

  return (
    <span
      className={cn(
        "font-medium",
        isCredit
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      )}
    >
      {isCredit ? "+" : "-"}
      {formattedAmount}
    </span>
  )
}

export function AdjustmentTable({ adjustments }: AdjustmentTableProps) {
  const columns = useMemo<ColumnDef<AdminAdjustment, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <AdjustmentTypeBadge type={row.original.type} />,
      },
      {
        accessorKey: "amountIdr",
        header: "Amount",
        cell: ({ row }) => (
          <AmountCell
            amountIdr={row.original.amountIdr}
            type={row.original.type}
          />
        ),
      },
      {
        accessorKey: "reason",
        header: "Description",
        cell: ({ row }) => (
          <span className="max-w-xs truncate text-muted-foreground">
            {row.original.reason || "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "createdByWorkosUserId",
        header: "Admin",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.createdByWorkosUserId ? "Admin" : "System"}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <DataTable
      tableId="portal-billing-adjustments"
      columns={columns}
      data={adjustments}
      searchableColumns={["reason", "type"]}
      searchPlaceholder="Search adjustments..."
      emptyMessage="No adjustments found."
    />
  )
}
