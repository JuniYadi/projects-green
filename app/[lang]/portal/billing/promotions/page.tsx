"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
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
import { DataTable } from "@/components/data-table"
import {
  PlusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CopySimpleIcon,
} from "@phosphor-icons/react"
import { formatBillingMoney } from "@/modules/billing/format-money"
import {
  VOUCHER_STATUS_COLORS,
  voucherKindLabel,
  type VoucherDTO,
} from "@/lib/billing-client"

const PAGE_SIZE = 20

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DEPLETED", label: "Depleted" },
  { value: "DISABLED", label: "Disabled" },
]

type PromoListItem = VoucherDTO & {
  discountDisplay: string
}

function buildDiscountDisplay(voucher: VoucherDTO): string {
  if (voucher.kind === "BALANCE_CREDIT") {
    return `${formatBillingMoney(voucher.amount, voucher.currency)} credit`
  }
  if (!voucher.discountType || !voucher.discountValue) {
    return "No discount configured"
  }
  const value = Number(voucher.discountValue)
  if (voucher.discountType === "PERCENTAGE") {
    return `${value}% off`
  }
  const currency = voucher.discountCurrency ?? voucher.currency
  return `${formatBillingMoney(value, currency)} off`
}

export default function BillingPromotionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [vouchers, setVouchers] = useState<PromoListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const statusFilter = searchParams.get("status") ?? ""
  const searchFilter = searchParams.get("search") ?? ""

  const offset = useMemo(() => {
    const page = Number(searchParams.get("page") ?? "1")
    return (page - 1) * PAGE_SIZE
  }, [searchParams])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(offset))
      if (statusFilter) params.set("status", statusFilter)
      if (searchFilter) params.set("prefix", searchFilter)

      const { data } = await eden.api.vouchers.portal.get({
        $query: Object.fromEntries(params.entries()),
      })

      if (!data) {
        setError("Failed to load vouchers")
        return
      }
      if (!data.ok) {
        setError(data.message || "Failed to load vouchers")
        return
      }

      const items: PromoListItem[] = (data.data as unknown as VoucherDTO[]).map(
        (v) => ({
          ...v,
          discountDisplay: buildDiscountDisplay(v),
        })
      )
      setVouchers(items)
      setTotal(data.total as number)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsLoading(false)
    }
  }, [offset, statusFilter, searchFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData()
  }, [fetchData])

  const copyCode = useCallback((code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(code)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  const updateQuery = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const goToPage = (newPage: number) => {
    updateQuery({ page: String(newPage) })
  }

  const columns = useMemo<ColumnDef<PromoListItem>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 font-mono text-xs font-medium">
            <Link
              href={`/portal/billing/promotions/${row.original.id}`}
              className="cursor-pointer hover:underline"
            >
              {row.original.code}
            </Link>
            <button
              onClick={(e) => copyCode(row.original.code, e)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Copy to clipboard"
            >
              <CopySimpleIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ),
      },
      {
        accessorKey: "kind",
        header: "Type",
        cell: ({ row }) => <span>{voucherKindLabel(row.original.kind)}</span>,
      },
      {
        accessorKey: "discountDisplay",
        header: "Discount",
        cell: ({ row }) => <span>{row.original.discountDisplay}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={
              VOUCHER_STATUS_COLORS[row.original.status ?? "DISABLED"] ?? ""
            }
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "claimedCount",
        header: "Claims",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.claimedCount}/{row.original.maxClaims}
          </span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: "Expires At",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.expiresAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [copyCode]
  )

  if (isLoading && vouchers.length === 0) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Promotions</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage discount vouchers and balance credits.
            </p>
          </div>
          <Button disabled>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Voucher
          </Button>
        </header>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage discount vouchers and balance credits.
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/billing/promotions/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Voucher
          </Link>
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <Input
                type="search"
                placeholder="Search by code prefix..."
                defaultValue={searchFilter}
                onChange={(e) => {
                  const value = e.target.value.trim()
                  const next = value || undefined
                  if (next) {
                    updateQuery({ search: next, page: "1" })
                  } else {
                    updateQuery({ search: undefined, page: "1" })
                  }
                }}
                className="w-full"
              />
              <MagnifyingGlassIcon className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(val) => {
                if (val === "ALL" || val === "") {
                  updateQuery({ status: undefined, page: "1" })
                } else {
                  updateQuery({ status: val, page: "1" })
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value || "ALL"} value={f.value || "ALL"}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable
          tableId="portal-billing-promotions"
          columns={columns}
          data={vouchers}
          searchPlaceholder="Search promotions..."
          searchableColumns={["code"]}
          defaultColumnVisibility={{
            createdAt: false,
          }}
        />
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden">
        {vouchers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No vouchers match your current filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {vouchers.map((voucher) => (
              <Link
                key={voucher.id}
                href={`/portal/billing/promotions/${voucher.id}`}
              >
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          <span className="font-mono">{voucher.code}</span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {voucherKindLabel(voucher.kind)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={VOUCHER_STATUS_COLORS[voucher.status] ?? ""}
                      >
                        {voucher.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Discount</dt>
                        <dd>{voucher.discountDisplay}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Claims</dt>
                        <dd>
                          {voucher.claimedCount}/{voucher.maxClaims}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Expires</dt>
                        <dd>
                          {new Date(voucher.expiresAt).toLocaleDateString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Target</dt>
                        <dd>
                          {voucher.targetWorkosUserId
                            ? "Specific user"
                            : voucher.targetOrganizationId
                              ? "Specific org"
                              : "Anyone"}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoading}
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
            >
              Next
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

function MagnifyingGlassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx={11} cy={11} r={8} />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}
