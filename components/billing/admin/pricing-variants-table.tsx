"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { billingPeriodLabel, type AdminPricing } from "@/lib/billing-client"

export function PricingVariantsTable({
  pricing,
  onDeactivate,
}: {
  pricing: AdminPricing[]
  onDeactivate?: (id: string) => void
}) {
  const columns: ColumnDef<AdminPricing>[] = [
    {
      id: "product",
      header: "Product / plan",
      accessorFn: (row) => `${row.packageCode} ${row.planCode}`,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.packageCode}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.planCode}
          </div>
        </div>
      ),
    },
    { accessorKey: "regionCode", header: "Region" },
    {
      accessorKey: "billingPeriod",
      header: "Period",
      cell: ({ row }) => billingPeriodLabel(row.original.billingPeriod),
    },
    {
      accessorKey: "periodPrice",
      header: "Price for entire period",
      cell: ({ row }) =>
        row.original.periodPrice === null
          ? "—"
          : formatBillingMoney(row.original.periodPrice, row.original.currency),
    },
    {
      accessorKey: "chargeUnit",
      header: "Charge unit",
      cell: ({ row }) =>
        row.original.chargeUnit === "DEVICE"
          ? "Per device"
          : "Per subscription",
    },
    {
      accessorKey: "effectiveFrom",
      header: "Effective",
      cell: ({ row }) => (
        <span className="text-xs">
          {new Date(row.original.effectiveFrom).toLocaleDateString()}{" "}
          {row.original.effectiveTo
            ? `– ${new Date(row.original.effectiveTo).toLocaleDateString()}`
            : "– open"}
        </span>
      ),
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
      cell: ({ row }) =>
        row.original.isActive && onDeactivate ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeactivate(row.original.id)}
          >
            Deactivate
          </Button>
        ) : null,
    },
  ]

  return (
    <DataTable
      tableId="admin-pricing-variants"
      columns={columns}
      data={pricing}
      searchableColumns={["product", "regionCode", "billingPeriod", "currency"]}
      searchPlaceholder="Search pricing variants..."
      emptyMessage="No pricing variants found."
    />
  )
}
