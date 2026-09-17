"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PencilSimple,
  Pause,
  Trash,
  CloudArrowDown,
  Heartbeat,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type DeviceActionsProps = {
  deviceId: string
  deviceStatus: string
  editHref: string
}

type ActionState = "idle" | "verifying" | "syncing"

export function DeviceActions({
  deviceId,
  deviceStatus,
  editHref,
}: DeviceActionsProps) {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalWhatsappDevicesDeviceActions
  const [actionState, setActionState] = useState<ActionState>("idle")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [resetQuotaOpen, setResetQuotaOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isResettingQuota, setIsResettingQuota] = useState(false)

  async function handleVerify() {
    setActionState("verifying")

    try {
      const { data } = await eden.api.whatsapp.devices[deviceId].verify.post()

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message || t.verifyDeviceFailed
        )
      }

      const health =
        "health" in (data ?? {})
          ? (data as { health?: { ok: boolean; error?: string } }).health
          : null
      if (health?.ok) {
        toast.success(t.deviceHealthy)
      } else {
        toast.error(
          t.healthCheckFailed.replace(
            "{error}",
            health?.error || t.unknownError
          )
        )
      }
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.verifyDeviceFailed
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }

  async function handleSyncTemplates() {
    setActionState("syncing")

    try {
      const res = await whatsappClient.devices.syncTemplates(deviceId)

      if (!res.ok) {
        throw new Error(
          (res as { message?: string })?.message || t.syncTemplatesFailed
        )
      }

      toast.success(res.message)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.syncTemplatesFailed
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }
  async function handleResetQuota() {
    setIsResettingQuota(true)
    try {
      const res = await whatsappClient.devices.resetQuota(deviceId)

      if (!res.ok) {
        throw new Error(
          (res as { message?: string })?.message || t.resetQuotaFailed
        )
      }

      toast.success(
        t.resetQuotaSuccess.replace(
          "{value}",
          res.newQuotaBaseOut.toLocaleString()
        )
      )
      setResetQuotaOpen(false)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.resetQuotaFailed
      toast.error(message)
    } finally {
      setIsResettingQuota(false)
    }
  }

  async function handleDeactivate() {
    setIsDeactivating(true)
    try {
      const { data } = await eden.api.admin.devices[deviceId].patch({
        status: "NON_ACTIVE",
      } as never)

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message || t.deactivateDeviceFailed
        )
      }

      toast.success(t.deactivateDeviceSuccess)
      setDeactivateOpen(false)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.deactivateDeviceFailed
      toast.error(message)
    } finally {
      setIsDeactivating(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const { data } = await eden.api.admin.devices[deviceId].delete()

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message || t.deleteDeviceFailed
        )
      }

      toast.success(t.deleteDeviceSuccess)
      setDeleteOpen(false)
      router.push("/portal/whatsapp/devices")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.deleteDeviceFailed
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const isActive = deviceStatus === "ACTIVE"

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleVerify}
          disabled={actionState !== "idle"}
        >
          <Heartbeat weight="bold" className="mr-1.5 size-4" />
          {actionState === "verifying" ? t.checking : t.healthCheck}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncTemplates}
          disabled={actionState !== "idle"}
        >
          <CloudArrowDown weight="bold" className="mr-1.5 size-4" />
          {actionState === "syncing" ? t.syncing : t.templateSync}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setResetQuotaOpen(true)}
          disabled={actionState !== "idle"}
        >
          <ArrowCounterClockwise weight="bold" className="mr-1.5 size-4" />
          {t.resetQuota}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={editHref}>
            <PencilSimple weight="bold" className="mr-1.5 size-4" />
            {t.edit}
          </Link>
        </Button>
        {isActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeactivateOpen(true)}
          >
            <Pause weight="bold" className="mr-1.5 size-4" />
            {t.deactivate}
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash weight="bold" className="mr-1.5 size-4" />
          {t.delete}
        </Button>
      </div>

      {/* Reset Quota Confirmation */}
      <Dialog open={resetQuotaOpen} onOpenChange={setResetQuotaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.resetQuotaDialogTitle}</DialogTitle>
            <DialogDescription>
              {t.resetQuotaDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetQuotaOpen(false)}
              disabled={isResettingQuota}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleResetQuota} disabled={isResettingQuota}>
              {isResettingQuota ? t.resetting : t.confirmReset}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Deactivate Confirmation */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deactivateDialogTitle}</DialogTitle>
            <DialogDescription>
              {t.deactivateDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeactivate()}
              disabled={isDeactivating}
            >
              {isDeactivating ? t.deactivating : t.deactivateDialogTitle}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteDialogTitle}</DialogTitle>
            <DialogDescription>{t.deleteDialogDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? t.deleting : t.deleteDialogTitle}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
