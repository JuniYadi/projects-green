"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@phosphor-icons/react"
import {
  getBillingAccount,
  updateBillingAlerts,
  type AlertPreferences,
  type AlertPreferencesInput,
} from "@/lib/billing-client"

const defaultPreferences: AlertPreferences = {
  balanceThresholdEnabled: false,
  balanceThresholdAmount: 50000,
  usageThresholdEnabled: false,
  usageThresholdAmount: 100000,
}

export function BillingAlertsForm() {
  const params = useParams<{ lang?: string }>()
  const page = getMessages(resolveLocaleOrDefault(params?.lang)).console.billing
    .alertsPage
  const [preferences, setPreferences] =
    useState<AlertPreferences>(defaultPreferences)
  const [initialPrefs, setInitialPrefs] =
    useState<AlertPreferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    getBillingAccount()
      .then((account) => {
        if (cancelled) return
        const prefs = {
          balanceThresholdEnabled:
            account.alertPreferences?.balanceThresholdEnabled ?? false,
          balanceThresholdAmount:
            account.alertPreferences?.balanceThresholdAmount ?? 50000,
          usageThresholdEnabled:
            account.alertPreferences?.usageThresholdEnabled ?? false,
          usageThresholdAmount:
            account.alertPreferences?.usageThresholdAmount ?? 100000,
        }
        setPreferences(prefs)
        setInitialPrefs(prefs)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : "Failed to load preferences"
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const isDirty =
    preferences.balanceThresholdEnabled !==
      initialPrefs.balanceThresholdEnabled ||
    preferences.balanceThresholdAmount !==
      initialPrefs.balanceThresholdAmount ||
    preferences.usageThresholdEnabled !== initialPrefs.usageThresholdEnabled ||
    preferences.usageThresholdAmount !== initialPrefs.usageThresholdAmount

  const updatePreference = useCallback(
    <K extends keyof AlertPreferences>(key: K, value: AlertPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }))
      setSaved(false)
    },
    []
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    setError(null)

    const input: AlertPreferencesInput = {
      balanceThresholdEnabled: preferences.balanceThresholdEnabled,
      balanceThresholdAmount: preferences.balanceThresholdAmount,
      usageThresholdEnabled: preferences.usageThresholdEnabled,
      usageThresholdAmount: preferences.usageThresholdAmount,
    }

    try {
      const account = await updateBillingAlerts(input)
      const prefs = {
        balanceThresholdEnabled:
          account.alertPreferences?.balanceThresholdEnabled ?? false,
        balanceThresholdAmount:
          account.alertPreferences?.balanceThresholdAmount ?? 50000,
        usageThresholdEnabled:
          account.alertPreferences?.usageThresholdEnabled ?? false,
        usageThresholdAmount:
          account.alertPreferences?.usageThresholdAmount ?? 100000,
      }
      setPreferences(prefs)
      setInitialPrefs(prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save preferences"
      )
    } finally {
      setSaving(false)
    }
  }, [preferences])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (
    error &&
    !preferences.balanceThresholdEnabled &&
    !preferences.usageThresholdEnabled
  ) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Threshold Alert */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <CardTitle>{page.lowBalanceTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {page.lowBalanceDesc}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="balance-threshold"
              checked={preferences.balanceThresholdEnabled}
              onCheckedChange={(checked) =>
                updatePreference("balanceThresholdEnabled", checked === true)
              }
            />
            <Label htmlFor="balance-threshold" className="cursor-pointer">
              {page.enableLowBalance}
            </Label>
          </div>
          {preferences.balanceThresholdEnabled && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="balance-amount">
                {page.balanceThresholdLabel}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rp</span>
                <Input
                  id="balance-amount"
                  type="number"
                  value={preferences.balanceThresholdAmount}
                  onChange={(e) =>
                    updatePreference(
                      "balanceThresholdAmount",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="w-40"
                  min={0}
                  step={10000}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {page.currentSettingBalance.replace(
                  "{amount}",
                  preferences.balanceThresholdAmount.toLocaleString()
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Threshold Alert */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <CardTitle>{page.usageThresholdTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {page.usageThresholdDesc}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="usage-threshold"
              checked={preferences.usageThresholdEnabled}
              onCheckedChange={(checked) =>
                updatePreference("usageThresholdEnabled", checked === true)
              }
            />
            <Label htmlFor="usage-threshold" className="cursor-pointer">
              {page.enableUsageThreshold}
            </Label>
          </div>
          {preferences.usageThresholdEnabled && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="usage-amount">{page.usageThresholdLabel}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rp</span>
                <Input
                  id="usage-amount"
                  type="number"
                  value={preferences.usageThresholdAmount}
                  onChange={(e) =>
                    updatePreference(
                      "usageThresholdAmount",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="w-40"
                  min={0}
                  step={10000}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {page.currentSettingUsage.replace(
                  "{amount}",
                  preferences.usageThresholdAmount.toLocaleString()
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Reminders — now handled by Billing Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CardTitle>{page.invoiceRemindersTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {page.invoiceRemindersDesc}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Invoice notification preferences are now managed per contact on the{" "}
            <Link
              href="/console/billing/contacts"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Billing Contacts
            </Link>{" "}
            page. Add or update contacts to control which email addresses
            receive invoice notifications.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
          {saving ? (
            <>
              <Spinner className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Preferences saved successfully!
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
