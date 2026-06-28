"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PencilSimple,
  Pause,
  Trash,
  CloudArrowDown,
  Heartbeat,
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
  const [actionState, setActionState] = useState<ActionState>("idle")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)

  async function handleVerify() {
    setActionState("verifying")

    try {
      const { data } = await eden.api.whatsapp.devices[deviceId].verify.post()

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message || "Failed to verify device"
        )
      }

      const health = "health" in (data ?? {}) ? (data as { health?: { ok: boolean; error?: string } }).health : null
      if (health?.ok) {
        toast.success("Device is connected and healthy")
      } else {
        toast.error(`Health check failed: ${health?.error || "Unknown error"}`)
      }
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify device"
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
          (res as { message?: string })?.message || "Failed to sync templates"
        )
      }

      toast.success(res.message)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync templates"
      toast.error(message)
    } finally {
      setActionState("idle")
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
          (data as { message?: string })?.message ||
            "Failed to deactivate device"
        )
      }

      toast.success("Device deactivated successfully")
      setDeactivateOpen(false)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to deactivate device"
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
          (data as { message?: string })?.message || "Failed to delete device"
        )
      }

      toast.success("Device deleted successfully")
      setDeleteOpen(false)
      router.push("/portal/whatsapp/devices")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete device"
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
          {actionState === "verifying" ? "Checking..." : "Health Check"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncTemplates}
          disabled={actionState !== "idle"}
        >
          <CloudArrowDown weight="bold" className="mr-1.5 size-4" />
          {actionState === "syncing" ? "Syncing..." : "Template Sync"}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={editHref}>
            <PencilSimple weight="bold" className="mr-1.5 size-4" />
            Edit
          </Link>
        </Button>
        {isActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeactivateOpen(true)}
          >
            <Pause weight="bold" className="mr-1.5 size-4" />
            Deactivate
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash weight="bold" className="mr-1.5 size-4" />
          Delete
        </Button>
      </div>

      {/* Deactivate Confirmation */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Device</DialogTitle>
            <DialogDescription>
              This device will be set to non-active and will no longer be able
              to send messages. Its data and history will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeactivate()}
              disabled={isDeactivating}
            >
              {isDeactivating ? "Deactivating..." : "Deactivate Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. The device will be
              removed from the system, and WhatsApp service for this number will
              be terminated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
