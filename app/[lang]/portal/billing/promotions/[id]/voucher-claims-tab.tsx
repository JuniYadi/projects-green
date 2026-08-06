"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatBillingMoney } from "@/modules/billing/format-money"
import type { VoucherClaimDTO } from "@/lib/billing-client"

const CLAIMS_PAGE_SIZE = 30

export function VoucherClaimsTab({
  voucherId,
  claims: initialClaims,
}: {
  voucherId: string
  claims: VoucherClaimDTO[]
}) {
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)

  const filtered = search
    ? initialClaims.filter(
        (c) =>
          c.workosUserId?.toLowerCase().includes(search.toLowerCase()) ||
          c.userName?.toLowerCase().includes(search.toLowerCase()) ||
          c.organizationId?.toLowerCase().includes(search.toLowerCase()) ||
          c.orgName?.toLowerCase().includes(search.toLowerCase())
      )
    : initialClaims

  const paginated = filtered.slice(offset, offset + CLAIMS_PAGE_SIZE)

  const loadMore = () => {
    setOffset((prev) => prev + CLAIMS_PAGE_SIZE)
  }

  void voucherId

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim History</CardTitle>
        <CardDescription>
          Everyone who has redeemed this voucher.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            type="search"
            placeholder="Filter by user or org..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            className="w-full"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Adjustment ID</TableHead>
                <TableHead>Claimed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No claims found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((claim, index) => (
                  <TableRow key={claim.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {offset + index + 1}
                    </TableCell>
                    <TableCell className="text-sm">
                      {claim.userName ?? claim.workosUserId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {claim.orgName ?? claim.organizationId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {claim.discountAmount
                        ? formatBillingMoney(
                            claim.discountAmount,
                            claim.discountCurrency ?? "IDR"
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {claim.billingAdjustmentId || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(claim.claimedAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filtered.length > CLAIMS_PAGE_SIZE &&
          offset + CLAIMS_PAGE_SIZE < filtered.length && (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load more
            </Button>
          )}
      </CardContent>
    </Card>
  )
}
