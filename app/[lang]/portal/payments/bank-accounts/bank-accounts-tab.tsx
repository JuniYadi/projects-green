"use client"

import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState, type FormEvent, useMemo } from "react"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"

interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
  currency: string
  supportedCurrencies?: string[]
  swiftCode?: string | null
  bankAddress?: string | null
  isActive: boolean
  isDefault: boolean
  createdAt: string
}

const CURRENCY_OPTIONS = ["IDR", "USD"] as const

function getSupportedCurrencies(formData: FormData): string[] {
  const selected = formData
    .getAll("supportedCurrencies")
    .map((value) => String(value))
    .filter(Boolean)

  return selected.length > 0 ? selected : ["IDR"]
}

function getAccountCurrencies(account: BankAccount): string[] {
  return account.supportedCurrencies?.length
    ? account.supportedCurrencies
    : [account.currency || "IDR"]
}

type BankAccountsRequestState =
  | { status: "loading" }
  | { status: "success"; data: BankAccount[] }
  | { status: "error"; message: string }

export function BankAccountsTab() {
  const [state, setState] = useState<BankAccountsRequestState>({ status: "loading" })
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)

  const bankAccountColumns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        id: "bank",
        accessorFn: (account) => account.bankName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Bank" />
        ),
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span className="font-medium">{row.original.bankName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.swiftCode || "No SWIFT code"}
            </span>
          </div>
        ),
      },
      {
        id: "account",
        accessorFn: (account) =>
          [account.accountNumber, account.accountName].filter(Boolean).join(" "),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Account" />
        ),
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span>{row.original.accountNumber}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.accountName}
            </span>
          </div>
        ),
      },
      {
        id: "currencies",
        accessorFn: (account) => getAccountCurrencies(account).join(", "),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Currencies" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {getAccountCurrencies(row.original).join(", ")}
          </Badge>
        ),
      },
      {
        id: "status",
        accessorFn: (account) => (account.isActive ? "active" : "inactive"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={row.original.isActive ? "default" : "secondary"}
              className="text-xs"
            >
              {row.original.isActive ? "Active" : "Inactive"}
            </Badge>
            {row.original.isDefault && (
              <Badge variant="outline" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {!row.original.isDefault && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => void handleSetDefault(row.original.id)}
              >
                Set Default
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditingAccount(row.original)}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [isSubmitting]
  )

  const fetchBankAccounts = useCallback(async () => {
    try {
      const { data: payload } = await eden.api.portal.payments["bank-accounts"].get()

      if (!payload) {
        setState({ status: "error", message: "Failed to load bank accounts" })
        return
      }
      if (!payload.ok) {
        setState({ status: "error", message: "message" in payload ? (payload as { message: string }).message : "Failed to load bank accounts" })
        return
      }
      setState({ status: "success", data: (payload.data || []) as unknown as BankAccount[] })
    } catch {
      setState({ status: "error", message: "Failed to load bank accounts" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBankAccounts()
  }, [fetchBankAccounts])

  async function handleCreateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    try {
      const body = {
        bankCode: String(formData.get("bankCode") || "OTHER"),
        bankName: String(formData.get("bankName") || ""),
        accountName: String(formData.get("accountName") || ""),
        accountNumber: String(formData.get("accountNumber") || ""),
        supportedCurrencies: getSupportedCurrencies(formData),
        swiftCode: String(formData.get("swiftCode") || "") || null,
        bankAddress: String(formData.get("bankAddress") || "") || null,
      }
      const { data: payload } = await eden.api.portal.payments["bank-accounts"].post(body as never)

      if (!payload?.ok) {
        setState({
          status: "error",
          message: payload?.message || "Failed to create bank account",
        })
        return
      }

      setIsCreating(false)
      await fetchBankAccounts()
    } catch {
      setState({ status: "error", message: "Failed to create bank account" })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingAccount) return
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    try {
      const body = {
        bankName: String(formData.get("bankName") || ""),
        accountName: String(formData.get("accountName") || ""),
        accountNumber: String(formData.get("accountNumber") || ""),
        supportedCurrencies: getSupportedCurrencies(formData),
        swiftCode: String(formData.get("swiftCode") || "") || null,
        bankAddress: String(formData.get("bankAddress") || "") || null,
      }
      const { data: payload } = await eden.api.portal.payments["bank-accounts"][editingAccount.id].put(body as never)

      if (!payload?.ok) {
        setState({
          status: "error",
          message: payload?.message || "Failed to update bank account",
        })
        return
      }

      setEditingAccount(null)
      await fetchBankAccounts()
    } catch {
      setState({ status: "error", message: "Failed to update bank account" })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSetDefault(accountId: string) {
    setIsSubmitting(true)
    try {
      const { data: payload } = await eden.api.portal.payments["bank-accounts"][accountId].toggle.patch()
      if (!payload?.ok) {
        setState({
          status: "error",
          message: payload?.message || "Failed to set default bank account",
        })
        return
      }
      await fetchBankAccounts()
    } catch {
      setState({ status: "error", message: "Failed to set default bank account" })
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
          {Array.from({ length: 3 }).map((_, i) => (
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
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchBankAccounts()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const bankAccounts = state.data

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Bank Accounts</CardTitle>
          {!editingAccount && (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              Add Bank Account
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCreating && (
          <form
            className="rounded-lg border bg-muted/20 p-4"
            onSubmit={handleCreateBankAccount}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Bank name</span>
                <Input name="bankName" placeholder="Bank Central Asia" required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Account number</span>
                <Input name="accountNumber" placeholder="1234567890" required />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Account holder</span>
                <Input name="accountName" placeholder="PT Projects Green" required />
              </label>
              <fieldset className="space-y-2 text-sm font-medium">
                <legend>Supported currencies</legend>
                <div className="flex flex-wrap gap-3 rounded-md border p-3">
                  {CURRENCY_OPTIONS.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="supportedCurrencies"
                        value={code}
                        defaultChecked={code === "IDR"}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="space-y-2 text-sm font-medium">
                <span>SWIFT/BIC code</span>
                <Input name="swiftCode" placeholder="CENAIDJA" />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Bank address</span>
                <Input
                  name="bankAddress"
                  placeholder="Bank branch or registered bank address"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create bank account"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {editingAccount && (
          <form
            className="rounded-lg border bg-muted/20 p-4"
            onSubmit={handleUpdateBankAccount}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Bank name</span>
                <Input
                  name="bankName"
                  defaultValue={editingAccount.bankName}
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Account number</span>
                <Input
                  name="accountNumber"
                  defaultValue={editingAccount.accountNumber}
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Account holder</span>
                <Input
                  name="accountName"
                  defaultValue={editingAccount.accountName}
                  required
                />
              </label>
              <fieldset className="space-y-2 text-sm font-medium">
                <legend>Supported currencies</legend>
                <div className="flex flex-wrap gap-3 rounded-md border p-3">
                  {CURRENCY_OPTIONS.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="supportedCurrencies"
                        value={code}
                        defaultChecked={getAccountCurrencies(editingAccount).includes(code)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="space-y-2 text-sm font-medium">
                <span>SWIFT/BIC code</span>
                <Input
                  name="swiftCode"
                  defaultValue={editingAccount.swiftCode ?? ""}
                  placeholder="CENAIDJA"
                />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Bank address</span>
                <Input
                  name="bankAddress"
                  defaultValue={editingAccount.bankAddress ?? ""}
                  placeholder="Bank branch or registered bank address"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save bank account"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditingAccount(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!editingAccount && (
          <>
            {bankAccounts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No bank accounts added yet.
              </div>
            ) : (
              <DataTable
                columns={bankAccountColumns}
                data={bankAccounts}
                searchPlaceholder="Filter bank accounts..."
                searchableColumns={["bank", "account", "currencies", "status"]}
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
                emptyMessage="No bank accounts match your filters."
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
