"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"

interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  isBase: boolean
  ratePerBase: number
  minTopup: number
  maxTopup: number
  isActive: boolean
  sortOrder: number
}

type CurrenciesRequestState =
  | { status: "loading" }
  | { status: "success"; data: Currency[] }
  | { status: "error"; message: string }

export function CurrenciesTab() {
  const [state, setState] = useState<CurrenciesRequestState>({ status: "loading" })
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editing, setEditing] = useState<Currency | null>(null)

  const currencyColumns = useMemo<ColumnDef<Currency>[]>(
    () => [
      {
        id: "currency",
        accessorFn: (currency) => `${currency.code} ${currency.name}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Currency" />
        ),
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span className="font-medium">{row.original.code}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "ratePerBase",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Rate" />
        ),
        cell: ({ row }) =>
          row.original.isBase
            ? "Base currency"
            : row.original.ratePerBase.toLocaleString(),
      },
      {
        id: "topupRange",
        accessorFn: (currency) => `${currency.minTopup} ${currency.maxTopup}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Top-up range" />
        ),
        cell: ({ row }) =>
          `${row.original.symbol}${row.original.minTopup.toLocaleString()} – ${
            row.original.symbol
          }${row.original.maxTopup.toLocaleString()}`,
      },
      {
        id: "status",
        accessorFn: (currency) => (currency.isActive ? "active" : "inactive"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            {row.original.isBase && (
              <Badge variant="default" className="text-xs">
                Base
              </Badge>
            )}
            <Badge
              variant={row.original.isActive ? "default" : "secondary"}
              className="text-xs"
            >
              {row.original.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => void handleToggle(row.original.id)}
            >
              {row.original.isActive ? "Disable" : "Enable"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(row.original)}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [isSubmitting]
  )

  const fetchCurrencies = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/currencies")
      if (!response.ok) {
        setState({ status: "error", message: "Failed to load currencies" })
        return
      }
      const payload = await response.json()
      if (payload.ok) {
        setState({ status: "success", data: payload.data || [] })
      } else {
        setState({ status: "error", message: payload.message || "Failed to load currencies" })
      }
    } catch {
      setState({ status: "error", message: "Failed to load currencies" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCurrencies()
  }, [fetchCurrencies])

  async function submitCurrency(
    url: string,
    method: "POST" | "PUT",
    formData: FormData,
    isBaseRow: boolean
  ) {
    setIsSubmitting(true)
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(method === "POST" ? { code: String(formData.get("code") || "").toUpperCase() } : {}),
          name: String(formData.get("name") || ""),
          symbol: String(formData.get("symbol") || ""),
          isBase: isBaseRow,
          ratePerBase: isBaseRow ? 1 : Number(formData.get("ratePerBase") || 0),
          minTopup: Number(formData.get("minTopup") || 0),
          maxTopup: Number(formData.get("maxTopup") || 0),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setState({ status: "error", message: payload.message || "Failed to save currency" })
        return false
      }
      await fetchCurrencies()
      return true
    } catch {
      setState({ status: "error", message: "Failed to save currency" })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isBaseRow = formData.get("isBase") === "on"
    const ok = await submitCurrency("/api/portal/payments/currencies", "POST", formData, isBaseRow)
    if (ok) setIsCreating(false)
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const formData = new FormData(event.currentTarget)
    const isBaseRow = formData.get("isBase") === "on"
    const ok = await submitCurrency(
      `/api/portal/payments/currencies/${editing.id}`,
      "PUT",
      formData,
      isBaseRow
    )
    if (ok) setEditing(null)
  }

  async function handleToggle(id: string) {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/portal/payments/currencies/${id}/toggle`, {
        method: "PATCH",
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setState({ status: "error", message: payload.message || "Failed to toggle currency" })
        return
      }
      await fetchCurrencies()
    } catch {
      setState({ status: "error", message: "Failed to toggle currency" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {state.message}
        <div className="mt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchCurrencies()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const currencies = state.data
  const base = currencies.find((c) => c.isBase)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Currencies</CardTitle>
            <p className="text-xs text-muted-foreground">
              Prices are authored in the base currency
              {base ? ` (${base.code})` : ""}. Rate = units of this currency per 1 base unit.
            </p>
          </div>
          {!editing && !isCreating && (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              Add Currency
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCreating && (
          <CurrencyForm
            onSubmit={handleCreate}
            isSubmitting={isSubmitting}
            onCancel={() => setIsCreating(false)}
            submitLabel="Create currency"
            withCode
          />
        )}

        {editing && (
          <CurrencyForm
            onSubmit={handleUpdate}
            isSubmitting={isSubmitting}
            onCancel={() => setEditing(null)}
            submitLabel="Save currency"
            current={editing}
          />
        )}

        {!editing && !isCreating && (
          <DataTable
            columns={currencyColumns}
            data={currencies}
            searchPlaceholder="Filter currencies..."
            searchableColumns={["currency", "status", "topupRange"]}
            facetFilters={[
              {
                columnId: "status",
                label: "Status",
                allLabel: "All status",
                options: [
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ],
              },
            ]}
            initialSorting={[{ id: "currency", desc: false }]}
            emptyMessage="No currencies match your filters."
          />
        )}
      </CardContent>
    </Card>
  )
}

function CurrencyForm({
  onSubmit,
  isSubmitting,
  onCancel,
  submitLabel,
  current,
  withCode,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  onCancel: () => void
  submitLabel: string
  current?: Currency
  withCode?: boolean
}) {
  return (
    <form className="rounded-lg border bg-muted/20 p-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        {withCode && (
          <label className="space-y-2 text-sm font-medium">
            <span>Code (ISO 4217)</span>
            <Input name="code" placeholder="USD" required />
          </label>
        )}
        <label className="space-y-2 text-sm font-medium">
          <span>Name</span>
          <Input name="name" defaultValue={current?.name} placeholder="US Dollar" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Symbol</span>
          <Input name="symbol" defaultValue={current?.symbol} placeholder="$" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Rate per base unit</span>
          <Input
            name="ratePerBase"
            type="number"
            step="0.000001"
            min="0"
            defaultValue={current?.ratePerBase}
            placeholder="18000"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Min top-up</span>
          <Input name="minTopup" type="number" step="0.01" min="0" defaultValue={current?.minTopup} required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Max top-up</span>
          <Input name="maxTopup" type="number" step="0.01" min="0" defaultValue={current?.maxTopup} required />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input type="checkbox" name="isBase" defaultChecked={current?.isBase} />
          <span>Base currency (rate pinned to 1)</span>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
