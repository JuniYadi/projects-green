"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getAdminOrgs,
  refreshAdminOrgMetadata,
  type AdminOrgSummary,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { defaultLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { getLocaleFromPathname, localizePathname } from "@/lib/i18n/pathname"

function makeColumns(
  linkPrefix: string,
  linkSuffix: string | undefined,
  messages: ReturnType<typeof getMessages>
): ColumnDef<AdminOrgSummary>[] {
  const suffix = linkSuffix ?? ""
  return [
    {
      accessorKey: "orgName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            messages.pPortalBillingOverviewOrgSummaryTable
              .organizationColumnTitle
          }
        />
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
      accessorKey: "ownerName",
      header: "Owner",
      cell: ({ row }) => {
        const name = row.original.ownerName
        const email = row.original.ownerEmail
        return <span>{name ?? email ?? "Unassigned"}</span>
      },
    },
    {
      accessorKey: "memberCount",
      header: "Members",
      cell: ({ row }) => <span>{row.original.memberCount}</span>,
    },
    {
      accessorKey: "balance",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            messages.pPortalBillingOverviewOrgSummaryTable.balanceColumnTitle
          }
        />
      ),
      cell: ({ row }) =>
        formatBillingMoney(row.original.balance, row.original.currency),
    },
    {
      accessorKey: "activeSubscriptions",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            messages.pPortalBillingOverviewOrgSummaryTable
              .subscriptionsColumnTitle
          }
        />
      ),
    },
    {
      accessorKey: "monthlySpend",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            messages.pPortalBillingOverviewOrgSummaryTable
              .monthlySpendColumnTitle
          }
        />
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
  const pathname = usePathname()
  const { locale } = getLocaleFromPathname(pathname)
  const activeLocale = locale ?? defaultLocale
  const orgsHref = localizePathname({
    pathname: "/portal/orgs",
    locale: activeLocale,
  })
  const messages = getMessages(activeLocale)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [currency, setCurrency] = useState<string>("all")
  const [orgs, setOrgs] = useState<AdminOrgSummary[]>([])
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    total: number
    totalPages: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (pageNum: number, searchTerm: string, currencyFilter: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await getAdminOrgs({
          limit,
          page: pageNum,
          ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
          ...(currencyFilter !== "all" ? { currency: currencyFilter } : {}),
        })
        setOrgs(res.orgs)
        setPagination(res.pagination)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load organizations"
        )
      } finally {
        setIsLoading(false)
      }
    },
    [limit]
  )
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchPage(page, search, currency)
  }, [page, search, currency, fetchPage])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleCurrencyChange = (value: string) => {
    setCurrency(value)
    setPage(1)
  }

  const handleRefresh = async () => {
    if (orgs.length === 0) return
    setError(null)
    try {
      await refreshAdminOrgMetadata({ orgIds: orgs.map((o) => o.orgId) })
      fetchPage(page, search, currency)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh metadata"
      )
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error && orgs.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          {
            messages.pPortalBillingOverviewOrgSummaryTable
              .failedToLoadOrganizations
          }{" "}
          {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            {
              messages.pPortalBillingOverviewOrgSummaryTable
                .organizationsCardTitle
            }
          </CardTitle>
          <Link
            href={orgsHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            {
              messages.pPortalBillingOverviewOrgSummaryTable
                .viewAllOrganizationsLink
            }
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 p-4 sm:flex-row">
          <Input
            placeholder={
              messages.pPortalBillingOverviewOrgSummaryTable
                .searchOrganizationsPlaceholder
            }
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-xs"
          />
          <Select value={currency} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-36">
              <SelectValue
                placeholder={
                  messages.pPortalBillingOverviewOrgSummaryTable
                    .allCurrenciesOption
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {
                  messages.pPortalBillingOverviewOrgSummaryTable
                    .allCurrenciesOption
                }
              </SelectItem>
              <SelectItem value="IDR">IDR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || orgs.length === 0}
          >
            {
              messages.pPortalBillingOverviewOrgSummaryTable
                .refreshMetadataButton
            }
          </Button>
        </div>
        <DataTable
          tableId="portal-billing-org-summary"
          columns={makeColumns(linkPrefix, linkSuffix, messages)}
          data={orgs}
          searchPlaceholder={
            messages.pPortalBillingOverviewOrgSummaryTable
              .searchLoadedOrganizationsPlaceholder
          }
          searchableColumns={[]}
        />
        {error && <p className="px-4 pb-2 text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {messages.pPortalBillingOverviewOrgSummaryTable.showingLabel}{" "}
            {orgs.length}{" "}
            {messages.pPortalBillingOverviewOrgSummaryTable.ofLabel}{" "}
            {pagination?.total ?? 0}{" "}
            {
              messages.pPortalBillingOverviewOrgSummaryTable
                .organizationsCountLabel
            }
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {messages.pPortalBillingOverviewOrgSummaryTable.pageLabel}{" "}
              {pagination?.page ?? page}{" "}
              {messages.pPortalBillingOverviewOrgSummaryTable.ofLabel}{" "}
              {pagination?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={isLoading || page <= 1}
            >
              {messages.pPortalBillingOverviewOrgSummaryTable.previousButton}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((v) => v + 1)}
              disabled={
                isLoading || !pagination || page >= pagination.totalPages
              }
            >
              {messages.pPortalBillingOverviewOrgSummaryTable.nextButton}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
