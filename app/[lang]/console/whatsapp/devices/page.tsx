"use client"

import * as React from "react"
import {
  Phone,
  Plus,
  PencilSimple,
  Trash,
  DotsThreeVertical,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type {
  DeviceListItem,
  DeviceStatus,
  DeviceEnvironment,
} from "@/modules/whatsapp/devices/devices.schemas"

// ─── Status badge ───────────────────────────────────────────────────────────

function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const variant: Record<DeviceStatus, "success" | "secondary"> = {
    ACTIVE: "success",
    NON_ACTIVE: "secondary",
  }

  const label: Record<DeviceStatus, string> = {
    ACTIVE: "Active",
    NON_ACTIVE: "Inactive",
  }

  return <Badge variant={variant[status]}>{label[status]}</Badge>
}

// ─── Empty form state ───────────────────────────────────────────────────────

const emptyFormState = {
  name: "",
  phoneNumber: "",
  environment: "LIVE" as DeviceEnvironment,
}

// ─── Page component ─────────────────────────────────────────────────────────

export default function WhatsAppDevicesPage() {
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [editingDevice, setEditingDevice] =
    React.useState<DeviceListItem | null>(null)
  const [deletingDevice, setDeletingDevice] =
    React.useState<DeviceListItem | null>(null)

  // Form states
  const [addForm, setAddForm] = React.useState(emptyFormState)
  const [editForm, setEditForm] = React.useState(emptyFormState)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadDevices = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { devices: items } = await whatsappClient.devices.list()
      setDevices(items)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load WhatsApp devices."
      )
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    const initDevices = async () => {
      try {
        const { devices: items } = await whatsappClient.devices.list()
        setDevices(items)
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load WhatsApp devices."
        )
      } finally {
        setIsLoading(false)
      }
    }

    initDevices()
  }, [])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleAddDevice = async () => {
    if (!addForm.name.trim() || !addForm.phoneNumber.trim()) {
      toast.error("Name and phone number are required.")
      return
    }

    setIsSubmitting(true)

    try {
      await whatsappClient.devices.create({
        name: addForm.name,
        phoneNumber: addForm.phoneNumber,
        environment: addForm.environment,
      })

      toast.success("Device added successfully.")
      setAddDialogOpen(false)
      setAddForm(emptyFormState)
      void loadDevices()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add device."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditDevice = async () => {
    if (!editingDevice) return

    if (!editForm.name.trim() || !editForm.phoneNumber.trim()) {
      toast.error("Name and phone number are required.")
      return
    }

    setIsSubmitting(true)

    try {
      await whatsappClient.devices.update(editingDevice.id, {
        name: editForm.name,
        phoneNumber: editForm.phoneNumber,
        environment: editForm.environment,
      })

      toast.success("Device updated successfully.")
      setEditDialogOpen(false)
      setEditingDevice(null)
      void loadDevices()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update device."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDevice = async () => {
    if (!deletingDevice) return

    setIsSubmitting(true)

    try {
      await whatsappClient.devices.delete(deletingDevice.id)

      toast.success("Device deleted successfully.")
      setDeleteDialogOpen(false)
      setDeletingDevice(null)
      void loadDevices()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete device."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Dialog open handlers ──────────────────────────────────────────────────

  const openEditDialog = (device: DeviceListItem) => {
    setEditingDevice(device)
    setEditForm({
      name: device.name,
      phoneNumber: device.phoneNumber,
      environment: device.environment,
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (device: DeviceListItem) => {
    setDeletingDevice(device)
    setDeleteDialogOpen(true)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">
            Manage your WhatsApp Business devices and connections.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>WhatsApp Devices</CardTitle>
              <CardDescription>
                Manage your WhatsApp Business devices
              </CardDescription>
            </div>
            <Skeleton className="h-9 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="size-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">
            Manage your WhatsApp Business devices and connections.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>WhatsApp Devices</CardTitle>
              <CardDescription>
                Manage your WhatsApp Business devices
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-2 text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
              <Button variant="outline" onClick={() => void loadDevices()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="text-muted-foreground">
          Manage your WhatsApp Business devices and connections.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>WhatsApp Devices</CardTitle>
            <CardDescription>
              Manage your WhatsApp Business devices
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus weight="bold" className="mr-2 size-4" />
            Add Device
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No devices configured yet
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setAddDialogOpen(true)}
              >
                Add your first device
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <Phone className="size-5 text-primary" weight="fill" />
                    </div>
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {device.phoneNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DeviceStatusBadge status={device.status} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <span className="sr-only">Open menu</span>
                          <DotsThreeVertical weight="bold" className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEditDialog(device)}
                        >
                          <PencilSimple className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => openDeleteDialog(device)}
                        >
                          <Trash className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
              Connect a new WhatsApp Business device to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
                placeholder="My WhatsApp Device"
                required
                aria-required="true"
              />
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
              <Label htmlFor="add-environment">Environment</Label>
              <Select
                value={addForm.environment}
                onValueChange={(value) =>
                  setAddForm({
                    ...addForm,
                    environment: value as DeviceEnvironment,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIVE">Live</SelectItem>
                  <SelectItem value="SANDBOX">Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false)
                setAddForm(emptyFormState)
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

      {/* ── Edit Device Dialog ─────────────────────────────────────────────── */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update the device name, phone number, or environment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="My WhatsApp Device"
                required
                aria-required="true"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={editForm.phoneNumber}
                onChange={(e) =>
                  setEditForm({ ...editForm, phoneNumber: e.target.value })
                }
                placeholder="+1234567890"
                inputMode="tel"
                autoComplete="tel"
                required
                aria-required="true"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-environment">Environment</Label>
              <Select
                value={editForm.environment}
                onValueChange={(value) =>
                  setEditForm({
                    ...editForm,
                    environment: value as DeviceEnvironment,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIVE">Live</SelectItem>
                  <SelectItem value="SANDBOX">Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleEditDevice()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────── */}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingDevice?.name ?? "this device"}</strong>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteDevice()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
