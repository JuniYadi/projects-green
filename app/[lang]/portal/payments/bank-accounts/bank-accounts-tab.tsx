"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState, type FormEvent } from "react"

interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
  currency: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
}

const CURRENCY_OPTIONS = ["IDR", "USD"] as const

type BankAccountsRequestState =
  | { status: "loading" }
  | { status: "success"; data: BankAccount[] }
  | { status: "error"; message: string }

export function BankAccountsTab() {
  const [state, setState] = useState<BankAccountsRequestState>({ status: "loading" })
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)

  const fetchBankAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/bank-accounts")

      if (!response.ok) {
        setState({ status: "error", message: "Failed to load bank accounts" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.data || [] })
      } else {
        setState({ status: "error", message: payload.message || "Failed to load bank accounts" })
      }
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
      const response = await fetch("/api/portal/payments/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode: String(formData.get("bankCode") || "OTHER"),
          bankName: String(formData.get("bankName") || ""),
          accountName: String(formData.get("accountName") || ""),
          accountNumber: String(formData.get("accountNumber") || ""),
          currency: String(formData.get("currency") || "IDR"),
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to create bank account",
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
      const response = await fetch(
        `/api/portal/payments/bank-accounts/${editingAccount.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankName: String(formData.get("bankName") || ""),
            accountName: String(formData.get("accountName") || ""),
            accountNumber: String(formData.get("accountNumber") || ""),
            currency: String(formData.get("currency") || "IDR"),
          }),
        }
      )
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to update bank account",
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
      const response = await fetch(
        `/api/portal/payments/bank-accounts/${accountId}/toggle`,
        { method: "PATCH" }
      )
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to set default bank account",
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
              <label className="space-y-2 text-sm font-medium">
                <span>Currency</span>
                <select
                  name="currency"
                  defaultValue="IDR"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
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
              <label className="space-y-2 text-sm font-medium">
                <span>Currency</span>
                <select
                  name="currency"
                  defaultValue={editingAccount.currency || "IDR"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
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
              <div className="space-y-3">
                {bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{account.bankName}</div>
                      <div className="text-xs text-muted-foreground">
                        {account.accountNumber} - {account.accountName}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={account.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {account.currency || "IDR"}
                        </Badge>
                        {account.isDefault && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!account.isDefault && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isSubmitting}
                          onClick={() => void handleSetDefault(account.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingAccount(account)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
