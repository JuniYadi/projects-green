"use client"

import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VoucherStatus } from "@prisma/client"

type VoucherDetail = {
  id: string
  code: string
  prefix: string | null
  status: VoucherStatus
  maxClaims: number
  claimedCount: number
  expiresAt: string
  amount: string
  currency: string
  targetWorkosUserId: string | null
  targetOrganizationId: string | null
  createdByWorkosUserId: string
  metadataJson: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  claims: VoucherClaimDTO[]
}

type VoucherClaimDTO = {
  id: string
  voucherId: string
  workosUserId: string
  organizationId: string
  billingAdjustmentId: string | null
  claimedAt: string
}

type ApiErrorResponse = {
  ok: false
  error: string
  message: string
}

type DetailResponse = {
  ok: true
  data: VoucherDetail
}

const STATUS_COLORS: Record<VoucherStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  EXPIRED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  DEPLETED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  DISABLED: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
}

type VoucherDetailProps = {
  voucherId: string
}

export function VoucherDetail({ voucherId }: VoucherDetailProps) {
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await eden.api.vouchers.portal[voucherId].get()

      if (data.ok) {
        setVoucher(data.data)
      } else {
        setError(data.message || "Failed to load voucher details")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsLoading(false)
    }
  }, [voucherId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!voucher) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Voucher not found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voucher Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Code
              </dt>
              <dd className="font-mono text-sm">{voucher.code}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Status
              </dt>
              <dd>
                <Badge
                  variant="secondary"
                  className={STATUS_COLORS[voucher.status] ?? ""}
                >
                  {voucher.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Amount
              </dt>
              <dd className="text-sm">
                {voucher.currency} {Number(voucher.amount).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Claims
              </dt>
              <dd className="text-sm">
                {voucher.claimedCount} / {voucher.maxClaims}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Expires At
              </dt>
              <dd className="text-sm">
                {new Date(voucher.expiresAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Created At
              </dt>
              <dd className="text-sm">
                {new Date(voucher.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            {voucher.targetWorkosUserId && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Target User
                </dt>
                <dd className="font-mono text-xs">
                  {voucher.targetWorkosUserId}
                </dd>
              </div>
            )}
            {voucher.targetOrganizationId && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Target Organization
                </dt>
                <dd className="font-mono text-xs">
                  {voucher.targetOrganizationId}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Claim History ({voucher.claims.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {voucher.claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No claims have been made for this voucher yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Organization ID</TableHead>
                    <TableHead>Claimed At</TableHead>
                    <TableHead>Adjustment ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voucher.claims.map((claim, index) => (
                    <TableRow key={claim.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {claim.workosUserId}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {claim.organizationId}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(claim.claimedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {claim.billingAdjustmentId || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
