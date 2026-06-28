"use client"

import * as React from "react"
import { Phone, PencilSimple, DotsThreeVertical } from "@phosphor-icons/react"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DeviceHealthBadge } from "@/modules/whatsapp/ui/device-health-badge"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type {
  DeviceListItem,
  DeviceStatus,
} from "@/modules/whatsapp/devices/devices.schemas"

// ─── Status badge ───────────────────────────────────────────────────────────

type DeviceStatusBadgeProps = {
  status: DeviceStatus
  messages: ReturnType<typeof getMessages>
}

function DeviceStatusBadge({ status, messages }: DeviceStatusBadgeProps) {
  if (status === "DISCONNECTED" || status === "UNKNOWN") return null

  const variant: Record<string, "success" | "secondary"> = {
    ACTIVE: "success",
    NON_ACTIVE: "secondary",
  }

  const label: Record<string, string> = {
    ACTIVE: messages.console.whatsapp.devices.active,
    NON_ACTIVE: messages.console.whatsapp.devices.inactive,
  }

  return <Badge variant={variant[status]}>{label[status]}</Badge>
}

// ─── Edit form state ───────────────────────────────────────────────────────

type EditFormState = {
  phoneNumber: string
}

const emptyEditFormState: EditFormState = {
  phoneNumber: "",
}

// ─── Page component ─────────────────────────────────────────────────────────

export default function WhatsAppDevicesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingDevice, setEditingDevice] =
    React.useState<DeviceListItem | null>(null)

  // Form states
  const [editForm, setEditForm] = React.useState(emptyEditFormState)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ── Data fetching ─────────────────────────────────────────────────────────

  // ponytail: not wrapped in useCallback — stable enough for effect dep
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
          : messages.console.whatsapp.devices.unableToLoad
      )
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
  // ponytail: loadDevices is stable, only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleEditDevice = async () => {
    if (!editingDevice) return

    if (!editForm.phoneNumber.trim()) {
      toast.error(messages.console.whatsapp.devices.phoneNumberRequired)
      return
    }

    setIsSubmitting(true)

    try {
      await whatsappClient.devices.update(editingDevice.id, {
        phoneNumber: editForm.phoneNumber,
      })

      toast.success(messages.console.whatsapp.devices.updated)
      setEditDialogOpen(false)
      setEditingDevice(null)
      void loadDevices()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.console.whatsapp.devices.unableToUpdate
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Dialog open handlers ──────────────────────────────────────────────────

  const openEditDialog = (device: DeviceListItem) => {
    setEditingDevice(device)
    setEditForm({
      phoneNumber: device.phoneNumber,
    })
    setEditDialogOpen(true)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
            <CardDescription>
              {messages.console.whatsapp.devices.cardDescription}
            </CardDescription>
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
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                {messages.console.whatsapp.devices.cardTitle}
              </CardTitle>
              <CardDescription>
                {messages.console.whatsapp.devices.cardDescription}
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
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.console.whatsapp.devices.heading}
        </h1>
        <p className="text-muted-foreground">
          {messages.console.whatsapp.devices.description} Quota and limits are
          managed by your admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
          <CardDescription>
            {messages.console.whatsapp.devices.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                {messages.console.whatsapp.devices.noDevices}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {messages.console.whatsapp.devices.noDevicesDescription}
              </p>
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
                      <p className="font-medium">{device.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.quotaBaseOut} / {device.quotaBase} messages
                        remaining
                        {device.dailyLimitMessage > 0 &&
                          ` · ${device.dailyLimitMessage} msg/day limit`}
                        {Number(device.balance) > 0 &&
                          ` · Balance: Rp${Number(device.balance).toLocaleString("id-ID")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DeviceHealthBadge status={device.status} lastHeartbeatAt={device.lastHeartbeatAt} />
                    <DeviceStatusBadge
                      status={device.status}
                      messages={messages}
                    />
                    {device.status === "ACTIVE" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <span className="sr-only">
                              {messages.console.whatsapp.devices.srOpenMenu}
                            </span>
                            <DotsThreeVertical
                              weight="bold"
                              className="size-4"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(device)}
                          >
                            <PencilSimple className="mr-2 size-4" />
                            {messages.console.whatsapp.devices.editPhoneNumber}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {device.status === "NON_ACTIVE" && (
                      <p className="text-xs text-muted-foreground">
                        {messages.console.whatsapp.devices.notifyAdmin}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Device Dialog ─────────────────────────────────────────────── */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {messages.console.whatsapp.devices.editDialogTitle}
            </DialogTitle>
            <DialogDescription>
              {messages.console.whatsapp.devices.editDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">
                {messages.console.whatsapp.devices.phoneNumber}
              </Label>
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
            {editingDevice && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-balance">
                    Balance
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (admin-managed)
                    </span>
                  </Label>
                  <Input
                    id="edit-balance"
                    value={new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(editingDevice.balance)}
                    disabled
                    className="bg-muted/50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-quota">
                    Monthly Quota
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (admin-managed)
                    </span>
                  </Label>
                  <Input
                    id="edit-quota"
                    value={`${editingDevice.quotaBaseOut} / ${editingDevice.quotaBase} messages remaining`}
                    disabled
                    className="bg-muted/50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-daily-limit">
                    Daily Limit
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (admin-managed)
                    </span>
                  </Label>
                  <Input
                    id="edit-daily-limit"
                    value={
                      editingDevice.dailyLimitMessage > 0
                        ? `${editingDevice.dailyLimitMessage} messages/day`
                        : "No limit"
                    }
                    disabled
                    className="bg-muted/50"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {messages.console.whatsapp.devices.cancel}
            </Button>
            <Button
              onClick={() => void handleEditDevice()}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? messages.console.whatsapp.devices.saving
                : messages.console.whatsapp.devices.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
