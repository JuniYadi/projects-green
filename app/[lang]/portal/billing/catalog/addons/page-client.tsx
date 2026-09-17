"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeftIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SquaresFour,
} from "@/components/ui/phosphor-icons"
import { useAdminAddonsQuery } from "@/hooks/use-billing-data"

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function PortalBillingAddonsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingCatalogAddonsPageClient

  const billingModeLabels: Record<string, string> = {
    RECURRING: t.billingModeRecurring,
    ONE_TIME: t.billingModeOneTime,
    USAGE: t.billingModeUsage,
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const {
    data,
    isLoading: loading,
    error,
  } = useAdminAddonsQuery({
    search: search.trim() || undefined,
    currency: "IDR",
  })
  const addons = data?.addons ?? []

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value.trim()) params.set("q", e.target.value)
    else params.delete("q")
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const addonColumns: ColumnDef<(typeof addons)[number]>[] = [
    {
      accessorKey: "code",
      header: t.codeColumn,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "name",
      header: t.nameColumn,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description && (
            <p className="text-xs text-muted-foreground">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "billingMode",
      header: t.billingModeColumn,
      cell: ({ row }) =>
        billingModeLabels[row.original.billingMode] ?? row.original.billingMode,
    },
    {
      id: "prices",
      header: t.pricesColumn,
      accessorFn: (row) => row.prices.length,
      cell: ({ row }) =>
        (row.original.prices.length === 1
          ? t.priceSingular
          : t.pricePlural
        ).replace("{count}", String(row.original.prices.length)),
    },
    {
      accessorKey: "isActive",
      header: t.statusColumn,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? t.activeStatus : t.inactiveStatus}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t.actionsColumn,
      cell: ({ row }) => (
        <Link
          href={`/portal/billing/catalog/addons/${row.original.code.toLowerCase()}`}
        >
          <Button variant="ghost" size="sm">
            <GearSixIcon className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/portal/billing/catalog">
              <Button variant="ghost" size="icon">
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{t.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Link href="/portal/billing/catalog/addons/new">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t.newAddon}
          </Button>
        </Link>
      </header>

      <div className="relative max-w-sm">
        <Input
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={handleSearch}
          className="pl-9"
          aria-label={t.searchAriaLabel}
        />
        <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error instanceof Error ? error.message : t.unableToLoad}
          </CardContent>
        </Card>
      ) : loading ? (
        <LoadingSkeleton />
      ) : addons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SquaresFour className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t.noAddonsMatch}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardTitle className="sr-only">{t.addonsListSrOnly}</CardTitle>
          <DataTable
            tableId="portal-billing-addons"
            columns={addonColumns}
            data={addons}
            searchableColumns={["code", "name", "billingMode"]}
            searchPlaceholder={t.searchTablePlaceholder}
            emptyMessage={t.noAddonsMatch}
          />
        </Card>
      )}
    </main>
  )
}
