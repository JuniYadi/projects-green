"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  WalletIcon,
  ReceiptIcon,
  UsersIcon,
  PackageIcon,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import type { AdminOrgDetail } from "@/lib/billing-client"
import type { VoucherDTO } from "@/modules/vouchers/vouchers.dto"
import { formatBillingMoney } from "@/modules/billing/format-money"

type OverviewTabProps = {
  _lang?: string
  orgId: string
  orgDetail: AdminOrgDetail
}

export function OverviewTab({ _lang, orgId, orgDetail }: OverviewTabProps) {
  const org = orgDetail.org
  const [vouchers, setVouchers] = useState<VoucherDTO[]>([])
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(true)
  const [voucherError, setVoucherError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchVouchers() {
      try {
        const res = await eden.api.vouchers.portal.get({
          $query: { limit: "5", offset: "0", organizationId: orgId },
        })
        if (cancelled) return
        if (!res.data) {
          setVoucherError("Failed to load voucher logs")
          return
        }
        if (!res.data.ok) {
          setVoucherError(res.data.message || "Failed to load voucher logs")
          return
        }
        setVouchers(res.data.data)
      } catch (err) {
        if (cancelled) return
        setVoucherError(
          err instanceof Error ? err.message : "Failed to load voucher logs"
        )
      } finally {
        if (!cancelled) setIsLoadingVouchers(false)
      }
    }
    void fetchVouchers()
    return () => {
      cancelled = true
    }
  }, [orgId])

  const summaryCards = [
    {
      title: "Balance",
      value: formatBillingMoney(org.balance, org.currency),
      icon: WalletIcon,
    },
    {
      title: "Active Products",
      value: org.subscriptions.length.toString(),
      icon: PackageIcon,
    },
    {
      title: "Members / Contacts",
      value: org.contacts.toString(),
      icon: UsersIcon,
    },
    {
      title: "Recent Invoices",
      value: org.recentInvoices.length.toString(),
      icon: ReceiptIcon,
    },
    {
      title: "Monthly Spend",
      value: formatBillingMoney(org.monthlySpend, "IDR"),
      icon: WalletIcon,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Voucher logs */}
      <Card>
        <CardHeader>
          <CardTitle>Voucher Generation Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingVouchers ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : voucherError ? (
            <p className="text-sm text-destructive">
              Failed to load voucher logs: {voucherError}
            </p>
          ) : vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No voucher generation logs for this organization.
            </p>
          ) : (
            <div className="space-y-2">
              {vouchers.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{v.code}</span>
                    <span
                      className={
                        v.status === "ACTIVE"
                          ? "text-green-600 dark:text-green-400"
                          : v.status === "EXPIRED"
                            ? "text-muted-foreground"
                            : "text-yellow-600 dark:text-yellow-400"
                      }
                    >
                      {v.status}
                    </span>
                    <span className="text-muted-foreground">
                      {formatBillingMoney(v.amount, v.currency)}
                    </span>
                    <span>{v.claimedCount} claimed</span>
                    <span>
                      {new Date(v.createdAt).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
