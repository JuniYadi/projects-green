"use client"

import * as React from "react"
import Link from "next/link"
import {
  Phone,
  ArrowsClockwise,
  WarningCircle,
  Plus,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AdminDevice = {
  id: string
  organizationId: string
  phoneNumber: string
  status: string
  balance: number
  quotaBase: number
  dailyLimitMessage: number
  createdAt: string
  updatedAt: string
}

type AdminOrganizationSummary = {
  id: string
  name: string
  externalId: string | null
  domains: string[]
  allowProfilesOutsideOrganization: boolean
  createdAt: string
  updatedAt: string
}

type AddDeviceForm = {
  organizationId: string
  phoneNumber: string
  name: string
  displayName: string
  whatsappBusinessAccountId: string
  whatsappPhoneId: string
  whatsappApplicationId: string
  callbackUrl: string
}

const emptyAddForm: AddDeviceForm = {
  organizationId: "",
  phoneNumber: "",
  name: "",
  displayName: "",
  whatsappBusinessAccountId: "",
  whatsappPhoneId: "",
  whatsappApplicationId: "",
  callbackUrl: "",
}

export default function AdminDevicesPage() {
  const [devices, setDevices] = React.useState<AdminDevice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [organizations, setOrganizations] = React.useState<AdminOrganizationSummary[]>([])
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [addForm, setAddForm] = React.useState<AddDeviceForm>(emptyAddForm)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadDevices = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/devices")
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to load devices.")
      }

      setDevices(body.devices)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrganizations = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizations")
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to load organizations.")
      }

      setOrganizations(body.data.organizations)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load organizations."
      )
    }
  }, [])

  const handleAddDevice = async () => {
    if (!addForm.organizationId.trim() || !addForm.phoneNumber.trim()) {
      toast.error("Organization and phone number are required.")
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch("/api/whatsapp/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: addForm.organizationId,
          phoneNumber: addForm.phoneNumber,
          name: addForm.name || "Admin Device",
          displayName: addForm.displayName || undefined,
          whatsappBusinessAccountId: addForm.whatsappBusinessAccountId || undefined,
          whatsappPhoneId: addForm.whatsappPhoneId || undefined,
          whatsappApplicationId: addForm.whatsappApplicationId || undefined,
          callbackUrl: addForm.callbackUrl || undefined,
        }),
      })
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to add device.")
      }

      toast.success("Device added successfully.")
      setAddDialogOpen(false)
      setAddForm(emptyAddForm)
      void loadDevices()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add device."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
  }, [loadDevices])

  const openAddDialog = async () => {
    if (organizations.length === 0) {
      await loadOrganizations()
    }
    setAddDialogOpen(true)
  }

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Devices (Admin)
          </h1>
          <p className="text-muted-foreground">
            Manage all WhatsApp devices across organizations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>
              Loading device list...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Devices (Admin)
          </h1>
          <p className="text-muted-foreground">
            Manage all WhatsApp devices across organizations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>Device list</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WarningCircle className="mb-3 size-10 text-destructive" />
              <p className="mb-2 text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button variant="outline" onClick={() => void loadDevices()}>
                <ArrowsClockwise className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices (Admin)</h1>
        <p className="text-muted-foreground">
          Manage all WhatsApp devices across organizations.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>
              {devices.length} device{devices.length !== 1 ? "s" : ""} found
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => void openAddDialog()}>
            <Plus className="mr-2 size-4" />
            Add Device
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No devices found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Devices will appear here once they are created by organizations.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <Link
                      href={`/admin/whatsapp/devices/${device.id}`}
                      className="font-medium hover:underline"
                    >
                      {device.phoneNumber}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Org:{" "}
                      <code className="rounded bg-muted px-1 text-xs">
                        {device.organizationId.slice(0, 12)}...
                      </code>{" "}
                      &middot; Balance:{" "}
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(device.balance)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      device.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {device.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add Device Dialog ──────────────────────────────────────────────── */}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add WhatsApp Device</DialogTitle>
            <DialogDescription>
              Register a new WhatsApp Business device for an organization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-org">Organization</Label>
              <Select
                value={addForm.organizationId}
                onValueChange={(value) =>
                  setAddForm({ ...addForm, organizationId: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone Number</Label>
              <Input
                id="add-phone"
                value={addForm.phoneNumber}
                onChange={(e) =>
                  setAddForm({ ...addForm, phoneNumber: e.target.value })
                }
                placeholder="+1234567890"
                inputMode="tel"
                autoComplete="tel"
                required
                aria-required="true"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-display-name">WhatsApp Display Name</Label>
              <Input
                id="add-display-name"
                value={addForm.displayName}
                onChange={(e) =>
                  setAddForm({ ...addForm, displayName: e.target.value })
                }
                placeholder="My Business Account"
              />
              <p className="text-xs text-muted-foreground">
                Shown in WhatsApp conversations. Optional.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-waba-id">WhatsApp Business Account ID</Label>
              <Input
                id="add-waba-id"
                value={addForm.whatsappBusinessAccountId}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    whatsappBusinessAccountId: e.target.value,
                  })
                }
                placeholder="WABA-xxxxxxxxxxxx"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-phone-id">WhatsApp Phone ID</Label>
              <Input
                id="add-phone-id"
                value={addForm.whatsappPhoneId}
                onChange={(e) =>
                  setAddForm({ ...addForm, whatsappPhoneId: e.target.value })
                }
                placeholder="Phone-xxxxxxxxxxxx"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-app-id">WhatsApp Application ID</Label>
              <Input
                id="add-app-id"
                value={addForm.whatsappApplicationId}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    whatsappApplicationId: e.target.value,
                  })
                }
                placeholder="App-xxxxxxxxxxxx"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-callback">Callback URL</Label>
              <Input
                id="add-callback"
                value={addForm.callbackUrl}
                onChange={(e) =>
                  setAddForm({ ...addForm, callbackUrl: e.target.value })
                }
                placeholder="https://example.com/whatsapp/callback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false)
                setAddForm(emptyAddForm)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddDevice()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
