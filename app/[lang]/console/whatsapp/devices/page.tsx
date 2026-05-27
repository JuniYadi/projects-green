"use client"

import * as React from "react"
import {
  Phone,
  CheckCircle,
  XCircle,
  Warning,
  PencilSimple,
  Trash,
  Plus,
} from "@phosphor-icons/react"
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

type DeviceItem = {
  id: string
  phoneNumber: string
  name: string
  status: string
  balance: number
}

function DeviceStatusBadge({ status }: { status: string }) {
  const config = {
    ACTIVE: {
      label: "Active",
      icon: CheckCircle,
      className: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
    NON_ACTIVE: {
      label: "Inactive",
      icon: XCircle,
      className: "text-gray-500 bg-gray-50 dark:bg-gray-900/20",
    },
    DISCONNECTED: {
      label: "Disconnected",
      icon: Warning,
      className: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
    },
  }

  const { label, icon: Icon, className } = config[status as keyof typeof config] || config.NON_ACTIVE

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon weight="fill" className="size-3.5" />
      {label}
    </span>
  )
}

export default function WhatsAppDevicesPage() {
  const [devices, setDevices] = React.useState<DeviceItem[]>([])
  const [loading] = React.useState(false)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [formData, setFormData] = React.useState({ name: "", phoneNumber: "", token: "" })

  return (
    <div className="space-y-6 p-6">
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
            <Phone weight="bold" className="mr-2 size-4" />
            Add Device
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : devices.length === 0 ? (
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
                        <Button variant="ghost" size="icon-sm">
                          <span className="sr-only">Open menu</span>
                          <svg
                            className="size-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <PencilSimple className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
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
              <Label htmlFor="add-name">Name (optional)</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My WhatsApp Device"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone Number *</Label>
              <Input
                id="add-phone"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-token">Access Token</Label>
              <Input
                id="add-token"
                type="password"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                placeholder="Enter your Meta access token"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setAddDialogOpen(false)}>
              Add Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}