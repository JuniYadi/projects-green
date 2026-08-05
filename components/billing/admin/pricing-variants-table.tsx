"use client"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / plan</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Price for entire period</TableHead>
            <TableHead>Charge unit</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pricing.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-muted-foreground"
              >
                No pricing variants found.
              </TableCell>
            </TableRow>
          ) : (
            pricing.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.packageCode}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.planCode}
                  </div>
                </TableCell>
                <TableCell>{item.regionCode}</TableCell>
                <TableCell>{billingPeriodLabel(item.billingPeriod)}</TableCell>
                <TableCell className="font-medium">
                  {item.periodPrice === null
                    ? "—"
                    : formatBillingMoney(item.periodPrice, item.currency)}
                </TableCell>
                <TableCell>
                  {item.chargeUnit === "DEVICE"
                    ? "Per device"
                    : "Per subscription"}
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(item.effectiveFrom).toLocaleDateString()}{" "}
                  {item.effectiveTo
                    ? `– ${new Date(item.effectiveTo).toLocaleDateString()}`
                    : "– open"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.isActive && onDeactivate ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeactivate(item.id)}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
