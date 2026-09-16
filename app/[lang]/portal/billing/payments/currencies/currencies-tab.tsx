"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"

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
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }

export function CurrenciesTab() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.adminBillingPayments.currencies
  const [state, setState] = useState<CurrenciesRequestState>({
    status: "loading",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editing, setEditing] = useState<Currency | null>(null)
  const [submitError, setSubmitError] = useState<{
    message: string
    fieldErrors?: Record<string, string[]>
  } | null>(null)

  const currencyColumns = useMemo<ColumnDef<Currency>[]>(
    () => [
      {
        id: "currency",
        accessorFn: (currency) => `${currency.code} ${currency.name}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.colCurrency} />
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
          <DataTableColumnHeader column={column} title={messages.colRate} />
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
          <DataTableColumnHeader
            column={column}
            title={messages.colTopUpRange}
          />
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
          <DataTableColumnHeader column={column} title={messages.colStatus} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            {row.original.isBase && (
              <Badge variant="default" className="text-xs">
                {messages.baseBadge}
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
              onClick={() => {
                setSubmitError(null)
                setEditing(row.original)
              }}
            >
              {messages.edit}
            </Button>
          </div>
        ),
      },
    ],
    // ponytail: handleToggle is a stable hoisted async function, adding it to deps causes churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSubmitting]
  )

  const fetchCurrencies = useCallback(async () => {
    try {
      const { data, error } = await eden.api.portal.payments.currencies.get()
      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            "Failed to load currencies",
        })
        return
      }
      setState({
        status: "success",
        data: (data as Currency[]) ?? [],
      })
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
    setSubmitError(null)
    try {
      const body = {
        ...(method === "POST"
          ? { code: String(formData.get("code") || "").toUpperCase() }
          : {}),
        name: String(formData.get("name") || ""),
        symbol: String(formData.get("symbol") || ""),
        isBase: isBaseRow,
        ratePerBase: isBaseRow ? 1 : Number(formData.get("ratePerBase") || 0),
        minTopup: Number(formData.get("minTopup") || 0),
        maxTopup: Number(formData.get("maxTopup") || 0),
      }
      let res: { data: unknown; error: unknown }
      if (method === "POST") {
        res = await eden.api.portal.payments.currencies.post(body as never)
      } else {
        res = await (
          eden.api.portal.payments.currencies.put as unknown as (
            ...args: never[]
          ) => Promise<{ data: unknown; error: unknown }>
        )(body as never)
      }
      if (res.error) {
        const errVal = (
          res.error as {
            value?: { message?: string; fieldErrors?: Record<string, string[]> }
          }
        )?.value
        setSubmitError({
          message: errVal?.message || "Failed to save currency",
          fieldErrors: errVal?.fieldErrors,
        })
        return false
      }
      setSubmitError(null)
      await fetchCurrencies()
      return true
    } catch {
      setSubmitError({ message: "Failed to save currency" })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isBaseRow = formData.get("isBase") === "on"
    const ok = await submitCurrency(
      "/api/portal/payments/currencies",
      "POST",
      formData,
      isBaseRow
    )
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
      const { error } =
        await eden.api.portal.payments.currencies[id].toggle.patch()
      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            "Failed to toggle currency",
        })
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchCurrencies()}
          >
            {messages.retry}
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
            <CardTitle className="text-base">{messages.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {messages.descriptionPrefix}
              {base ? ` (${base.code})` : ""}
              {messages.descriptionSuffix}
            </p>
          </div>
          {!editing && !isCreating && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSubmitError(null)
                setIsCreating(true)
              }}
            >
              {messages.addCurrency}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {submitError.message}
          </div>
        )}
        {isCreating && (
          <CurrencyForm
            onSubmit={handleCreate}
            isSubmitting={isSubmitting}
            onCancel={() => {
              setSubmitError(null)
              setIsCreating(false)
            }}
            submitLabel={messages.createSubmitLabel}
            withCode
            fieldErrors={submitError?.fieldErrors}
          />
        )}

        {editing && (
          <CurrencyForm
            onSubmit={handleUpdate}
            isSubmitting={isSubmitting}
            onCancel={() => {
              setSubmitError(null)
              setEditing(null)
            }}
            submitLabel={messages.saveSubmitLabel}
            current={editing}
            fieldErrors={submitError?.fieldErrors}
          />
        )}

        {!editing && !isCreating && (
          <DataTable
            tableId="portal-payments-currencies"
            columns={currencyColumns}
            data={currencies}
            searchPlaceholder={messages.searchPlaceholder}
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
            emptyMessage={messages.emptyMessage}
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
  fieldErrors,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  onCancel: () => void
  submitLabel: string
  current?: Currency
  withCode?: boolean
  fieldErrors?: Record<string, string[]>
}) {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.adminBillingPayments.currencies
  return (
    <form className="rounded-lg border bg-muted/20 p-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        {withCode && (
          <label className="space-y-2 text-sm font-medium">
            <span>{messages.codeIso}</span>
            <Input name="code" placeholder="USD" required />
            {fieldErrors?.code && (
              <p className="text-xs text-destructive">{fieldErrors.code[0]}</p>
            )}
          </label>
        )}
        <label className="space-y-2 text-sm font-medium">
          <span>{messages.name}</span>
          <Input
            name="name"
            defaultValue={current?.name}
            placeholder={messages.namePlaceholder}
            required
          />
          {fieldErrors?.name && (
            <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
          )}
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{messages.symbol}</span>
          <Input
            name="symbol"
            defaultValue={current?.symbol}
            placeholder="$"
            required
          />
          {fieldErrors?.symbol && (
            <p className="text-xs text-destructive">{fieldErrors.symbol[0]}</p>
          )}
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{messages.ratePerBase}</span>
          <Input
            name="ratePerBase"
            type="number"
            step="0.000001"
            min="0"
            defaultValue={current?.ratePerBase}
            placeholder="18000"
          />
          {fieldErrors?.ratePerBase && (
            <p className="text-xs text-destructive">
              {fieldErrors.ratePerBase[0]}
            </p>
          )}
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{messages.minTopUp}</span>
          <Input
            name="minTopup"
            type="number"
            step="0.01"
            min="0"
            defaultValue={current?.minTopup}
            required
          />
          {fieldErrors?.minTopup && (
            <p className="text-xs text-destructive">
              {fieldErrors.minTopup[0]}
            </p>
          )}
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{messages.maxTopUp}</span>
          <Input
            name="maxTopup"
            type="number"
            step="0.01"
            min="0"
            defaultValue={current?.maxTopup}
            required
          />
          {fieldErrors?.maxTopup && (
            <p className="text-xs text-destructive">
              {fieldErrors.maxTopup[0]}
            </p>
          )}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input
            type="checkbox"
            name="isBase"
            defaultChecked={current?.isBase}
          />
          <span>{messages.baseCurrencyNotice}</span>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {messages.cancel}
        </Button>
      </div>
    </form>
  )
}
