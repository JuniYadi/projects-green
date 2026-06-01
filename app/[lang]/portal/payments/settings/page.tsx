"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SettingsData {
  expiryDays: number
  autoApproveThreshold: number
}

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    expiryDays: 7,
    autoApproveThreshold: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/portal/payments/settings")
        const data = await res.json()
        if (data.ok) {
          setSettings(data.data)
        }
      } catch {
        setError("Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/portal/payments/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Settings saved successfully")
      } else {
        setError(data.message || "Failed to save settings")
      }
    } catch {
      setError("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Settings</h1>
        <p className="text-muted-foreground">Configure payment expiry and approval settings</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment Configuration</CardTitle>
          <CardDescription>Manage payment expiry and auto-approval thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="expiryDays">Payment Expiry Days (1-30)</Label>
            <Input
              id="expiryDays"
              type="number"
              min={1}
              max={30}
              value={settings.expiryDays}
              onChange={(e) =>
                setSettings({ ...settings, expiryDays: parseInt(e.target.value) || 7 })
              }
            />
            <p className="text-sm text-muted-foreground">
              Number of days before an unpaid invoice expires
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autoApproveThreshold">Auto-Approve Threshold (0 = disabled)</Label>
            <Input
              id="autoApproveThreshold"
              type="number"
              min={0}
              value={settings.autoApproveThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoApproveThreshold: parseInt(e.target.value) || 0,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Invoices below this amount will be auto-approved (set to 0 to disable)
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
