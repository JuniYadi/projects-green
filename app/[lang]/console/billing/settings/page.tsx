"use client"

import { useCallback, useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@phosphor-icons/react"
import { getBillingAccount, updateBillingCurrency } from "@/lib/billing-client"

type Currency = "USD" | "IDR"

type PageState = "loading" | "loaded" | "error"

export default function BillingSettingsPage() {
  const [state, setState] = useState<PageState>("loading")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [hasInvoices, setHasInvoices] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const fetchSettings = useCallback(async () => {
    setState("loading")
    try {
      const account = await getBillingAccount()
      setCurrency(account.preferredCurrency)
      // Check if any contacts exist as a heuristic for whether account has activity.
      // The real invoice check is done server-side on save.
      setHasInvoices(false) // Optimistic — server will gate this
      setState("loaded")
    } catch {
      setState("error")
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await fetchSettings()
    }
    run()
  }, [fetchSettings])

  const handleCurrencyChange = useCallback((value: string) => {
    setCurrency(value as Currency)
    setIsDirty(true)
    setMessage(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!isDirty) return
    setIsSaving(true)
    setMessage(null)

    try {
      const result = await updateBillingCurrency(currency)
      setCurrency(result.preferredCurrency)
      setIsDirty(false)
      setMessage({ type: "success", text: "Currency preference updated." })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update currency"
      if (msg.includes("CURRENCY_LOCKED") || msg.includes("currency")) {
        setMessage({
          type: "error",
          text: "Cannot change currency after invoices exist. Current currency is locked.",
        })
        setHasInvoices(true)
      } else {
        setMessage({ type: "error", text: msg })
      }
    } finally {
      setIsSaving(false)
    }
  }, [currency, isDirty])

  if (state === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Billing Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure billing preferences.
          </p>
        </header>
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-4 h-10 w-40" />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (state === "error") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Billing Settings</h1>
        </header>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load billing settings.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void fetchSettings()}
          >
            Retry
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure billing preferences for your organization.
        </p>
      </header>

      {/* Currency preference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferred Currency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your organization&apos;s default currency for invoices and billing
            display.{" "}
            {hasInvoices
              ? "This setting is locked because invoices already exist."
              : "Once an invoice is created, this preference is locked."}
          </p>

          <div className="flex items-center gap-3">
            <Select
              value={currency}
              onValueChange={handleCurrencyChange}
              disabled={hasInvoices}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — US Dollar</SelectItem>
                <SelectItem value="IDR">IDR — Indonesian Rupiah</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving || hasInvoices}
            >
              {isSaving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>

          {message && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                message.type === "success"
                  ? "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
                  : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {hasInvoices && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              Currency cannot be changed because invoices have been issued for
              this account. The current currency is locked for consistency.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
