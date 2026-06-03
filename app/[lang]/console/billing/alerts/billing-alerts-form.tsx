"use client"

import { useCallback, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  BellIcon,
  WalletIcon,
  LightningIcon,
  Envelope,
} from "@phosphor-icons/react"

type AlertPreferences = {
  balanceThresholdEnabled: boolean
  balanceThresholdAmount: number
  usageThresholdEnabled: boolean
  usageThresholdAmount: number
  invoiceReminderEnabled: boolean
}

const STORAGE_KEY = "billing-alert-preferences"

const defaultPreferences: AlertPreferences = {
  balanceThresholdEnabled: false,
  balanceThresholdAmount: 50000,
  usageThresholdEnabled: false,
  usageThresholdAmount: 100000,
  invoiceReminderEnabled: false,
}

function loadPreferences(): AlertPreferences {
  if (typeof window === "undefined") return defaultPreferences

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.warn("Failed to parse stored alert preferences:", e)
  }
  return defaultPreferences
}

function savePreferences(prefs: AlertPreferences) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function BillingAlertsForm() {
  const [preferences, setPreferences] = useState<AlertPreferences>(() => {
    if (typeof window === "undefined") return defaultPreferences
    return loadPreferences()
  })
  const [saved, setSaved] = useState(false)

  const updatePreference = useCallback(
    <K extends keyof AlertPreferences>(key: K, value: AlertPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }))
      setSaved(false)
    },
    []
  )

  const handleSave = useCallback(() => {
    savePreferences(preferences)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [preferences])

  return (
    <div className="space-y-6">
      {/* Balance Threshold Alert */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <WalletIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <CardTitle>Low Balance Alert</CardTitle>
              <p className="text-sm text-muted-foreground">
                Get notified when your balance falls below a threshold.
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
              Enable low balance alert
            </Label>
          </div>
          {preferences.balanceThresholdEnabled && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="balance-amount">Alert when balance below</Label>
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
                Current setting: Alert when balance falls below Rp{" "}
                {preferences.balanceThresholdAmount.toLocaleString()}
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
              <LightningIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Usage Threshold Alert</CardTitle>
              <p className="text-sm text-muted-foreground">
                Get notified when daily usage exceeds a limit.
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
              Enable usage threshold alert
            </Label>
          </div>
          {preferences.usageThresholdEnabled && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="usage-amount">
                Alert when daily usage exceeds
              </Label>
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
                Current setting: Alert when daily usage exceeds Rp{" "}
                {preferences.usageThresholdAmount.toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Reminder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Envelope className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>Invoice Reminders</CardTitle>
              <p className="text-sm text-muted-foreground">
                Receive email notifications for new invoices.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="invoice-reminder"
              checked={preferences.invoiceReminderEnabled}
              onCheckedChange={(checked) =>
                updatePreference("invoiceReminderEnabled", checked === true)
              }
            />
            <Label htmlFor="invoice-reminder" className="cursor-pointer">
              Send email when new invoice is issued
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave}>
          <BellIcon className="mr-2 h-4 w-4" />
          Save Preferences
        </Button>
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Preferences saved successfully!
          </p>
        )}
      </div>

      {/* localStorage notice */}
      <p className="text-xs text-muted-foreground">
        Alert preferences are stored locally in your browser. They will not
        persist across devices and will be lost if you clear browser data. Backend
        integration for server-side persistence is planned.
      </p>
    </div>
  )
}
